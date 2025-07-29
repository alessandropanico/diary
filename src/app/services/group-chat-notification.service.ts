// src/app/services/group-chat-notification.service.ts

import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, from, of, forkJoin } from 'rxjs';
import { switchMap, tap, map, catchError, distinctUntilChanged, filter } from 'rxjs/operators';
import { getAuth, User as FirebaseUser } from 'firebase/auth';

// ⭐⭐⭐ AGGIUNGI QUESTI IMPORT DI FIRESTORE ⭐⭐⭐
import { doc, updateDoc, serverTimestamp, Timestamp } from '@angular/fire/firestore';

import { GroupChatService, GroupChat, GroupMessage } from './group-chat.service';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { isPlatform } from '@ionic/angular';
import { UserDataService } from './user-data.service'; // Per salvare il token FCM nel profilo utente

@Injectable({
  providedIn: 'root'
})
export class GroupChatNotificationService implements OnDestroy {

  private unreadGroupCount$ = new BehaviorSubject<number>(0);
  private authSubscription: Subscription | undefined;
  private groupMessagesSubscriptions: Map<string, Subscription> = new Map(); // Mappa per le sottoscrizioni ai messaggi di ciascun gruppo

  private currentUserId: string | null = null;
  private audio: HTMLAudioElement;

  private lastSoundPlayedTimestamp: number = 0;
  private minSoundInterval: number = 2000; // Intervallo minimo tra i suoni (2 secondi)

  // Mappa per tenere traccia dell'ultimo timestamp notificato per ciascun gruppo
  // per evitare notifiche duplicate per lo stesso messaggio in caso di ri-render
  private lastNotifiedGroupMessageTimestamp: Map<string, number> = new Map();

  // Mappa per tenere traccia dell'ultimo timestamp di lettura dell'utente per ciascun gruppo
  private lastReadTimestampsForGroups: Map<string, Timestamp | null> = new Map();

  private readonly LOCAL_STORAGE_KEY_GROUP_TIMESTAMPS = 'groupChatNotificationLastNotifiedTimestamps';

  // ID del gruppo chat attualmente attivo (l'utente è su questa pagina chat)
  private currentActiveGroupChatId: string | null = null;

  // Variabili per la gestione delle notifiche push (simili al ChatNotificationService)
  private fcmToken: string | null = null;
  private pushNotificationsInitialized = false;

  constructor(
    private groupChatService: GroupChatService,
    private router: Router,
    private ngZone: NgZone,
    private userDataService: UserDataService // Iniettato per salvare FCM token
  ) {
    this.audio = new Audio('assets/sound/notification.mp3');
    this.loadLastNotifiedTimestamps(); // Carica i timestamp salvati
    this.init();
    this.initPushNotifications();
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    this.groupMessagesSubscriptions.forEach(sub => sub.unsubscribe());
    this.groupMessagesSubscriptions.clear();

    this.saveLastNotifiedTimestamps();
    this.setCurrentActiveGroupChat(null); // Resetta la chat attiva alla distruzione

    if (isPlatform('capacitor')) {
      PushNotifications.removeAllListeners();
    }
  }

  /**
   * Imposta l'ID del gruppo chat che l'utente sta visualizzando attivamente.
   * Quando l'utente entra in una chat di gruppo, i messaggi in quella chat non dovrebbero suonare.
   * @param groupId L'ID del gruppo chat, o null se l'utente non è in nessuna chat di gruppo.
   */
  public async setCurrentActiveGroupChat(groupId: string | null) {
    this.currentActiveGroupChatId = groupId;
    if (this.currentUserId && this.currentActiveGroupChatId) {
      // Quando l'utente entra in una chat, marca tutti i messaggi come letti per quella chat
      await this.groupChatService.markGroupMessagesAsRead(this.currentActiveGroupChatId, this.currentUserId)
        .catch(error => console.error('Errore nel marcare i messaggi di gruppo come letti all\'ingresso chat:', error));

      // Resetta il timestamp di ultima notifica per questa specifica chat
      this.lastNotifiedGroupMessageTimestamp.delete(this.currentActiveGroupChatId);
      this.saveLastNotifiedTimestamps(); // Salva immediatamente per persistenza
    }
  }

  private init() {
    const auth = getAuth();

    this.authSubscription = new Observable<FirebaseUser | null>(observer => {
      const unsubscribe = auth.onAuthStateChanged(user => {
        observer.next(user);
      });
      return unsubscribe;
    }).pipe(
      switchMap((user: FirebaseUser | null) => {
        this.currentUserId = user ? user.uid : null;

        if (this.currentUserId) {

          // Ottieni la lista dei gruppi a cui l'utente appartiene
          return this.groupChatService.getGroupsForUser(this.currentUserId).pipe(
            // All'arrivo di nuovi gruppi o modifiche ai gruppi dell'utente
            tap((groups: GroupChat[]) => this.manageGroupMessageListeners(groups)),
            // Calcola il totale dei messaggi non letti per la badge
            switchMap((groups: GroupChat[]) => {
              if (groups.length === 0) {
                return of(0);
              }
              const unreadCountsObservables: Observable<number>[] = groups.map(group => {
                // Carica il lastReadTimestamp specifico per questo gruppo e utente
                return this.groupChatService.getLastReadTimestamp(group.groupId!, this.currentUserId!).pipe(
                  switchMap(lastReadTs => {
                    this.lastReadTimestampsForGroups.set(group.groupId!, lastReadTs); // Salva per riutilizzo
                    return from(this.groupChatService.countUnreadMessagesForGroup(group.groupId!, this.currentUserId!, lastReadTs));
                  }),
                  catchError(err => {
                    console.error(`Errore nel conteggio messaggi non letti per gruppo ${group.groupId}:`, err);
                    return of(0);
                  })
                );
              });
              return forkJoin(unreadCountsObservables).pipe(
                map(counts => counts.reduce((sum, current) => sum + current, 0)),
                distinctUntilChanged(),
                tap(total => console.log('GroupChatNotificationService: Totale messaggi non letti (gruppi) calcolato:', total)),
                catchError(err => {
                  console.error('GroupChatNotificationService: Errore durante la somma dei messaggi non letti (gruppi):', err);
                  return of(0);
                })
              );
            }),
            catchError(err => {
              console.error('GroupChatNotificationService: Errore nel recupero dei gruppi dell\'utente:', err);
              return of(0);
            })
          );
        } else {
          // Utente disconnesso o non loggato
          this.unreadGroupCount$.next(0);
          this.groupMessagesSubscriptions.forEach(sub => sub.unsubscribe());
          this.groupMessagesSubscriptions.clear();
          this.lastNotifiedGroupMessageTimestamp.clear();
          this.lastReadTimestampsForGroups.clear();
          this.saveLastNotifiedTimestamps();
          return of(0);
        }
      })
    ).subscribe({
      next: (totalUnread: number) => {
        this.unreadGroupCount$.next(totalUnread);
      },
      error: (err) => {
        console.error('GroupChatNotificationService: Errore nella pipeline principale (authSubscription):', err);
        this.unreadGroupCount$.next(0);
      }
    });
  }

  /**
   * Gestisce le sottoscrizioni ai messaggi per ogni gruppo dell'utente.
   * Aggiunge listener per i nuovi gruppi e rimuove per quelli a cui non appartiene più.
   * @param currentGroups La lista aggiornata dei gruppi a cui l'utente appartiene.
   */
  private manageGroupMessageListeners(currentGroups: GroupChat[]) {
    if (!this.currentUserId) return;

    const currentGroupIds = new Set(currentGroups.map(g => g.groupId!));

    // Rimuovi sottoscrizioni per gruppi a cui l'utente non appartiene più
    this.groupMessagesSubscriptions.forEach((sub, groupId) => {
      if (!currentGroupIds.has(groupId)) {
        sub.unsubscribe();
        this.groupMessagesSubscriptions.delete(groupId);
        this.lastNotifiedGroupMessageTimestamp.delete(groupId); // Pulizia
        this.lastReadTimestampsForGroups.delete(groupId); // Pulizia
      }
    });

    // Aggiungi sottoscrizioni per i nuovi gruppi o quelli esistenti che devono essere monitorati
    currentGroups.forEach(group => {
      if (!this.groupMessagesSubscriptions.has(group.groupId!)) {

        // Recupera l'ultimo timestamp di lettura per questo gruppo specifico
        this.groupChatService.getLastReadTimestamp(group.groupId!, this.currentUserId!).pipe(
          switchMap(lastReadTs => {
            this.lastReadTimestampsForGroups.set(group.groupId!, lastReadTs); // Aggiorna la mappa
            // Ascolta i messaggi che sono arrivati DOPO l'ultimo messaggio letto dall'utente
            // (o tutti se non ci sono letture precedenti)
            const queryTimestamp = lastReadTs || new Timestamp(0, 0); // Inizia da 0,0 se non c'è lastRead
            return this.groupChatService.getNewGroupMessages(group.groupId!, queryTimestamp);
          }),
          // Filtra i messaggi che non devono generare una notifica sonora
          filter(messages => messages.some(msg =>
            msg.senderId !== this.currentUserId && // Non inviato da me
            msg.type !== 'system' && // Non è un messaggio di sistema
            msg.timestamp.toMillis() > (this.lastNotifiedGroupMessageTimestamp.get(group.groupId!) || 0) && // Non notificato in precedenza
            this.currentActiveGroupChatId !== group.groupId! // Non sono nella chat attiva
          )),
          tap(newMessages => {
            // Controlla se c'è almeno un messaggio che dovrebbe far suonare la notifica
            const shouldPlaySound = newMessages.some(msg =>
              msg.senderId !== this.currentUserId &&
              msg.type !== 'system' &&
              msg.timestamp.toMillis() > (this.lastNotifiedGroupMessageTimestamp.get(group.groupId!) || 0) &&
              this.currentActiveGroupChatId !== group.groupId!
            );

            if (shouldPlaySound) {
              const currentTime = Date.now();
              if (currentTime - this.lastSoundPlayedTimestamp > this.minSoundInterval) {
                this.playNotificationSound();
                this.lastSoundPlayedTimestamp = currentTime;
              }
              // Aggiorna l'ultimo timestamp notificato per tutti i messaggi appena arrivati
              newMessages.forEach(msg => {
                this.lastNotifiedGroupMessageTimestamp.set(group.groupId!, msg.timestamp.toMillis());
              });
              this.saveLastNotifiedTimestamps(); // Salva per persistenza
            }
          }),
          catchError(err => {
            console.error(`Errore nel listener messaggi per gruppo ${group.groupId}:`, err);
            return of([]);
          })
        ).subscribe(
          () => {
            // Non facciamo nulla qui nel next, la logica di notifica è nel tap
          },
          err => {
            console.error('Errore nella sottoscrizione del gruppo:', err);
          }
        );
      }
    });
    this.saveLastNotifiedTimestamps(); // Salva lo stato aggiornato dei timestamp di notifica
  }

  private playNotificationSound() {
    this.audio.currentTime = 0;
    this.audio.play().catch((e: any) => console.warn("Errore durante la riproduzione del suono (GroupChatNotificationService):", e));
  }

  getUnreadGroupCount$(): Observable<number> {
    return this.unreadGroupCount$.asObservable();
  }

  private saveLastNotifiedTimestamps() {
    try {
      const dataToSave = Array.from(this.lastNotifiedGroupMessageTimestamp.entries());
      localStorage.setItem(this.LOCAL_STORAGE_KEY_GROUP_TIMESTAMPS, JSON.stringify(dataToSave));
    } catch (e) {
      console.error('GroupChatNotificationService: Errore nel salvare lastNotifiedTimestamps nel localStorage:', e);
    }
  }

  private loadLastNotifiedTimestamps() {
    try {
      const savedData = localStorage.getItem(this.LOCAL_STORAGE_KEY_GROUP_TIMESTAMPS);
      if (savedData) {
        const parsedData: [string, number][] = JSON.parse(savedData);
        this.lastNotifiedGroupMessageTimestamp = new Map(parsedData);
      }
    } catch (e) {
      console.error('GroupChatNotificationService: Errore nel caricare lastNotifiedTimestamps dal localStorage:', e);
      this.lastNotifiedGroupMessageTimestamp = new Map();
    }
  }

  // --- Implementazione per Notifiche Push (simile al ChatNotificationService) ---
  async initPushNotifications() {
    if (!isPlatform('capacitor') || this.pushNotificationsInitialized) {
      return;
    }

    this.pushNotificationsInitialized = true;

    let permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive === 'prompt') {
      // Potresti mostrare un messaggio all'utente per chiedere il permesso
    }
    if (permStatus.receive !== 'granted') {
      console.warn('GroupChatNotificationService: Permessi di notifica non concessi. Impossibile ricevere push.');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', token => {
      this.ngZone.run(() => {
        this.fcmToken = token.value;
        if (this.currentUserId && this.fcmToken) {
          this.saveFcmTokenToFirestore(this.currentUserId, this.fcmToken);
        } else {
          console.warn('GroupChatNotificationService: Impossibile salvare il token FCM. Utente non loggato o token nullo.');
        }
      });
    });

    PushNotifications.addListener('registrationError', error => {
      this.ngZone.run(() => {
        console.error('GroupChatNotificationService: Errore di registrazione Push:', error);
      });
    });

    PushNotifications.addListener('pushNotificationReceived', notification => {
      this.ngZone.run(() => {
        if (notification.data && notification.data['groupId'] && this.router.url !== `/group-chat/${notification.data['groupId']}`) {
        }
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      this.ngZone.run(() => {
        const data = action.notification.data;
        if (data && data['groupId']) {
          this.router.navigateByUrl(`/group-chat/${data['groupId']}`);
        }
      });
    });

    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && this.currentUserId) {
      }
    });
  }

  private async saveFcmTokenToFirestore(userId: string, token: string): Promise<void> {
    if (!userId || !token) {
      console.warn('GroupChatNotificationService: Impossibile salvare token FCM. userId o token sono nulli.');
      return;
    }
    try {
      // ⭐⭐ CORREZIONE QUI: UserDataService espone 'firestore' non 'afs' ⭐⭐
      // Usiamo l'istanza di firestore da userDataService
      const userDocRef = doc(this.userDataService['firestore'], 'users', userId);
      await updateDoc(userDocRef, {
        fcmTokens: {
          [token]: true
        },
        lastLoginTokenUpdate: serverTimestamp()
      });
    } catch (error) {
      console.error(`GroupChatNotificationService: Errore nel salvare il token FCM per utente ${userId}:`, error);
    }
  }
}
