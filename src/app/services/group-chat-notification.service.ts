// src/app/services/group-chat-notification.service.ts

import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, from, of, forkJoin } from 'rxjs';
import { switchMap, tap, map, catchError, distinctUntilChanged, filter } from 'rxjs/operators';
import { getAuth, User as FirebaseUser } from 'firebase/auth';

import { doc, updateDoc, serverTimestamp, Timestamp, getFirestore, Firestore } from '@angular/fire/firestore';

import { GroupChatService, GroupChat, GroupMessage } from './group-chat.service';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { isPlatform } from '@ionic/angular';
import { UserDataService } from './user-data.service';

@Injectable({
  providedIn: 'root'
})
export class GroupChatNotificationService implements OnDestroy {

  private unreadGroupCount$ = new BehaviorSubject<number>(0);
  private authSubscription: Subscription | undefined;
  private groupMessagesSubscriptions: Map<string, Subscription> = new Map();

  private currentUserId: string | null = null;
  private audio: HTMLAudioElement;

  private lastSoundPlayedTimestamp: number = 0;
  private minSoundInterval: number = 2000;

  private lastNotifiedGroupMessageTimestamp: Map<string, number> = new Map();
  private lastReadTimestampsForGroups: Map<string, Timestamp | null> = new Map();

  private readonly LOCAL_STORAGE_KEY_GROUP_TIMESTAMPS = 'groupChatNotificationLastNotifiedTimestamps';

  private currentActiveGroupChatId: string | null = null;

  private fcmToken: string | null = null;
  private pushNotificationsInitialized = false;

  private hasInitialGroupsLoaded = false;
  private lastKnownGroups = new Map<string, GroupChat>();

  constructor(
    private groupChatService: GroupChatService,
    private router: Router,
    private ngZone: NgZone,
    private userDataService: UserDataService,
    private firestore: Firestore
  ) {
    this.audio = new Audio('assets/sound/notification.mp3');
    this.loadLastNotifiedTimestamps();
    this.init();
    this.initPushNotifications();
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    this.saveLastNotifiedTimestamps();
    this.setCurrentActiveGroupChat(null);

    if (isPlatform('capacitor')) {
      PushNotifications.removeAllListeners();
    }
  }

  public async setCurrentActiveGroupChat(groupId: string | null) {
    this.currentActiveGroupChatId = groupId;
    if (this.currentUserId && this.currentActiveGroupChatId) {
      await this.groupChatService.markGroupMessagesAsRead(this.currentActiveGroupChatId, this.currentUserId)
        .catch(error => console.error('GroupChatNotificationService: Errore nel marcare i messaggi di gruppo come letti all\'ingresso chat:', error));

      this.lastNotifiedGroupMessageTimestamp.delete(this.currentActiveGroupChatId);
      this.saveLastNotifiedTimestamps();
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
      tap(user => console.log('GroupChatNotificationService: Stato autenticazione cambiato. Utente ID:', user ? user.uid : 'Nessuno')),
      switchMap((user: FirebaseUser | null) => {
        this.currentUserId = user ? user.uid : null;

        if (this.currentUserId) {
          return this.groupChatService.getGroupsForUser(this.currentUserId).pipe(
            tap((groups: GroupChat[]) => {
              if (!this.hasInitialGroupsLoaded) {
                groups.forEach(group => {
                  this.lastKnownGroups.set(group.groupId!, group);
                  const currentLastMessageTime = (group.lastMessage && group.lastMessage.timestamp instanceof Timestamp) ? group.lastMessage.timestamp.toMillis() : 0;
                  this.lastNotifiedGroupMessageTimestamp.set(group.groupId!, currentLastMessageTime);
                });
                this.saveLastNotifiedTimestamps();
                this.hasInitialGroupsLoaded = true;
              } else {
                this.checkForNewGroupMessagesAndPlaySound(groups);
              }
              this.manageGroupMessageListeners(groups);
            }),
            switchMap((groups: GroupChat[]) => {
              if (groups.length === 0) {
                return of(0);
              }
              const unreadCountsObservables: Observable<number>[] = groups.map(group => {
                return this.groupChatService.getLastReadTimestamp(group.groupId!, this.currentUserId!).pipe(
                  tap(lastReadTs => {
                    this.lastReadTimestampsForGroups.set(group.groupId!, lastReadTs);
                  }),
                  switchMap(lastReadTs => {
                    const queryTimestamp = lastReadTs || new Timestamp(0, 0);
                    return from(this.groupChatService.countUnreadMessagesForGroup(group.groupId!, this.currentUserId!, queryTimestamp));
                  }),
                  tap(count => console.log(`GroupChatNotificationService: Messaggi non letti calcolati per gruppo ${group.groupId}:`, count)),
                  catchError(err => {
                    console.error(`GroupChatNotificationService: Errore nel conteggio messaggi non letti per gruppo ${group.groupId}:`, err);
                    return of(0);
                  })
                );
              });
              return forkJoin(unreadCountsObservables).pipe(
                map(counts => counts.reduce((sum, current) => sum + current, 0)),
                distinctUntilChanged(),
                tap(total => console.log('GroupChatNotificationService: Totale messaggi non letti (gruppi) calcolato PRIMA dell\'emissione del Subject:', total)),
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
          this.unreadGroupCount$.next(0);
          this.groupMessagesSubscriptions.forEach(sub => sub.unsubscribe());
          this.groupMessagesSubscriptions.clear();
          this.lastNotifiedGroupMessageTimestamp.clear();
          this.lastReadTimestampsForGroups.clear();
          this.lastKnownGroups.clear();
          this.saveLastNotifiedTimestamps();
          this.hasInitialGroupsLoaded = false;
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

  private manageGroupMessageListeners(currentGroups: GroupChat[]) {
    if (!this.currentUserId) {
      return;
    }

    const currentGroupIds = new Set(currentGroups.map(g => g.groupId!));

    this.groupMessagesSubscriptions.forEach((sub, groupId) => {
      if (!currentGroupIds.has(groupId)) {
        sub.unsubscribe();
        this.groupMessagesSubscriptions.delete(groupId);
        this.lastNotifiedGroupMessageTimestamp.delete(groupId);
        this.lastReadTimestampsForGroups.delete(groupId);
        this.lastKnownGroups.delete(groupId);
      }
    });

    currentGroups.forEach(group => {
      if (!this.groupMessagesSubscriptions.has(group.groupId!)) {
        const subscription = this.groupChatService.getLastReadTimestamp(group.groupId!, this.currentUserId!).pipe(
          switchMap(lastReadTs => {
            this.lastReadTimestampsForGroups.set(group.groupId!, lastReadTs);
            const queryTimestamp = lastReadTs || new Timestamp(0, 0);
            return this.groupChatService.getNewGroupMessages(group.groupId!, queryTimestamp);
          }),
          tap(messages => {
            // ⭐⭐ AGGIORNAMENTO: Logica per aggiornare il conteggio quando arrivano nuovi messaggi ⭐⭐
            if (messages && messages.length > 0) {
              // Ricalcolo completo del conteggio
              this.recalculateAndEmitUnreadCount();
            }
          }),
          catchError(err => {
            console.error(`GroupChatNotificationService: Errore nel listener messaggi per gruppo ${group.groupId} (per dati freschi):`, err);
            return of([]);
          })
        ).subscribe(
          () => { },
          err => {
            console.error('GroupChatNotificationService: Errore nella sottoscrizione del gruppo (listener specifico):', err);
          }
        );
        this.groupMessagesSubscriptions.set(group.groupId!, subscription);
      }
    });
    this.saveLastNotifiedTimestamps();
  }
 
  // ⭐⭐ AGGIORNAMENTO: Nuovo metodo per ricalcolare il conteggio non letto ⭐⭐
  private recalculateAndEmitUnreadCount() {
    if (!this.currentUserId) return;
    this.groupChatService.getGroupsForUser(this.currentUserId).pipe(
      switchMap(groups => {
        if (groups.length === 0) {
          return of(0);
        }
        const unreadCountsObservables: Observable<number>[] = groups.map(group => {
          return from(this.groupChatService.countUnreadMessagesForGroup(
            group.groupId!,
            this.currentUserId!,
            this.lastReadTimestampsForGroups.get(group.groupId!) || new Timestamp(0, 0)
          ));
        });
        return forkJoin(unreadCountsObservables).pipe(
          map(counts => counts.reduce((sum, current) => sum + current, 0)),
          distinctUntilChanged()
        );
      }),
      catchError(err => {
        console.error('GroupChatNotificationService: Errore durante il ricalcolo dei messaggi non letti (gruppi):', err);
        return of(0);
      })
    ).subscribe(totalUnread => {
      console.log('GroupChatNotificationService: Totale messaggi non letti (gruppi) ricalcolato:', totalUnread);
      this.unreadGroupCount$.next(totalUnread);
    });
  }

  private async checkForNewGroupMessagesAndPlaySound(currentGroups: GroupChat[]) {
    if (!this.currentUserId) {
      console.warn('GroupChatNotificationService: checkForNewGroupMessagesAndPlaySound chiamato senza currentUserId.');
      return;
    }

    let shouldPlaySoundForAnyGroup = false;
    const newKnownGroups = new Map<string, GroupChat>();

    for (const group of currentGroups) {
      const lastKnownGroup = this.lastKnownGroups.get(group.groupId!);
      const isCurrentActiveGroupChat = this.currentActiveGroupChatId && (this.currentActiveGroupChatId === group.groupId!);

      // ⭐⭐ Dati rilevanti per il debug ⭐⭐
      const currentLastMessageTime = (group.lastMessage && group.lastMessage.timestamp instanceof Timestamp) ? group.lastMessage.timestamp.toMillis() : 0;
      const lastKnownMessageTime = (lastKnownGroup?.lastMessage && lastKnownGroup.lastMessage.timestamp instanceof Timestamp) ? lastKnownGroup.lastMessage.timestamp.toMillis() : 0;
      const lastNotifiedTime = this.lastNotifiedGroupMessageTimestamp.get(group.groupId!) || 0;
      const senderId = group.lastMessage?.senderId || 'N/A';
      const messageText = group.lastMessage?.text || '';
      const condition1 = currentLastMessageTime > 0;
      const condition2 = senderId !== this.currentUserId;
      const condition3 = !isCurrentActiveGroupChat;
      const condition4 = currentLastMessageTime > lastKnownMessageTime;
      const condition5 = currentLastMessageTime > lastNotifiedTime;
      const condition6 = messageText.trim() !== '';

      if (
        condition1 &&
        condition2 &&
        condition3 &&
        condition4 &&
        condition5 &&
        condition6
      ) {
        shouldPlaySoundForAnyGroup = true;
        this.lastNotifiedGroupMessageTimestamp.set(group.groupId!, currentLastMessageTime);
      } else {
      }
      newKnownGroups.set(group.groupId!, group);
    }

    const currentTime = Date.now();
    if (shouldPlaySoundForAnyGroup && (currentTime - this.lastSoundPlayedTimestamp > this.minSoundInterval)) {
      this.playNotificationSound();
      this.lastSoundPlayedTimestamp = currentTime;
    } else if (shouldPlaySoundForAnyGroup) {
    }

    this.lastKnownGroups = newKnownGroups;
    this.saveLastNotifiedTimestamps();
  }

  private playNotificationSound() {
    this.audio.currentTime = 0;
    this.audio.play().catch((e: any) => console.warn("GroupChatNotificationService: Errore durante la riproduzione del suono:", e));
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
      } else {
      }
    } catch (e) {
      console.error('GroupChatNotificationService: Errore nel caricare lastNotifiedTimestamps dal localStorage:', e);
      this.lastNotifiedGroupMessageTimestamp = new Map();
    }
  }

  async initPushNotifications() {
    if (!isPlatform('capacitor') || this.pushNotificationsInitialized) {
      return;
    }

    this.pushNotificationsInitialized = true;

    let permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive === 'prompt') {
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
          // Logica per visualizzare una notifica in-app se l'app è in foreground ma non sulla chat specifica
          // o per aggiornare il conteggio se necessario.
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
        // Potresti voler ri-calcolare il conteggio non letto qui o forzare un refresh
        // per assicurarti che lo stato sia aggiornato quando l'app torna in foreground.
      }
    });
  }

  private async saveFcmTokenToFirestore(userId: string, token: string): Promise<void> {
    if (!userId || !token) {
      console.warn('GroupChatNotificationService: Impossibile salvare token FCM. userId o token sono nulli.');
      return;
    }
    try {
      const userDocRef = doc(this.firestore, 'users', userId);
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

  async markAllNotificationsAsRead() {
    const user = getAuth().currentUser;
    if (!user) {
      console.warn('GroupChatNotificationService: Impossibile marcare notifiche come lette, utente non loggato.');
      return;
    }

    try {
      const markPromises = Array.from(this.lastKnownGroups.keys()).map(groupId => {
        return this.groupChatService.markGroupMessagesAsRead(groupId, user.uid);
      });
      await Promise.all(markPromises);

      this.unreadGroupCount$.next(0);
      this.lastNotifiedGroupMessageTimestamp.clear();
      this.saveLastNotifiedTimestamps();

    } catch (error) {
      console.error('GroupChatNotificationService: Errore nel marcare tutti i messaggi di gruppo come letti:', error);
    }
  }
}
