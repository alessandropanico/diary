// src/app/services/group-chat-notification.service.ts

import { Injectable, OnDestroy, NgZone, forwardRef, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, from, of, forkJoin, combineLatest } from 'rxjs';
import { switchMap, tap, map, catchError, distinctUntilChanged, filter, take } from 'rxjs/operators';
import { getAuth, User as FirebaseUser } from 'firebase/auth';

import { doc, updateDoc, serverTimestamp, Timestamp, getFirestore, Firestore } from '@angular/fire/firestore';

import { GroupChatService, GroupChat, GroupMessage } from './group-chat.service';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { isPlatform } from '@ionic/angular';
import { UserDataService } from './user-data.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GroupChatNotificationService implements OnDestroy {

  private unreadGroupCount$ = new BehaviorSubject<number>(0);
  private currentActiveGroupChatId$ = new BehaviorSubject<string | null>(null);
  private authSubscription: Subscription | undefined;
  private groupMessagesSubscriptions: Map<string, Subscription> = new Map();

  private currentUserId: string | null = null;
  private audio: HTMLAudioElement;

  private lastSoundPlayedTimestamp: number = 0;
  private minSoundInterval: number = 2000;

  private lastNotifiedGroupMessageTimestamp: Map<string, number> = new Map();
  private lastReadTimestampsForGroups: Map<string, Timestamp | null> = new Map();

  private readonly LOCAL_STORAGE_KEY_GROUP_TIMESTAMPS = 'groupChatNotificationLastNotifiedTimestamps';

  private fcmToken: string | null = null;
  private pushNotificationsInitialized = false;

  private hasInitialGroupsLoaded = false;
  private lastKnownGroups = new Map<string, GroupChat>();

  constructor(
    @Inject(forwardRef(() => GroupChatService)) private groupChatService: GroupChatService,
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
    console.log('--- START setCurrentActiveGroupChat ---');
    this.currentActiveGroupChatId$.next(groupId);

    if (!this.currentUserId || !groupId) {
      console.log(`GroupChatNotificationService: setCurrentActiveGroupChat terminato prematuramente. currentUserId: ${!!this.currentUserId}, groupId: ${!!groupId}`);
      console.log('--- END setCurrentActiveGroupChat ---');
      return;
    }

    try {
      console.log(`GroupChatNotificationService: Tentativo di marcare i messaggi di ${groupId} come letti.`);

      // Ottieni l'ultimo messaggio dal database (una sola volta)
      const groupDetails = await firstValueFrom(this.groupChatService.getGroupDetails(groupId).pipe(take(1)));
      const latestMessageTimestamp = groupDetails?.lastMessage?.timestamp as Timestamp | undefined;

      if (!latestMessageTimestamp) {
        console.log('GroupChatNotificationService: Nessun ultimo messaggio trovato, operazione annullata.');
        return;
      }

      // Aggiorna il timestamp dell'ultima lettura nel database (Firestore)
      await this.groupChatService.markGroupMessagesAsRead(groupId, this.currentUserId, latestMessageTimestamp);
      console.log('GroupChatNotificationService: Aggiornamento di Firestore completato.');

      // Pulisci i timestamp di notifica per questo gruppo
      this.lastNotifiedGroupMessageTimestamp.delete(groupId);
      this.saveLastNotifiedTimestamps();

      // Aggiorna la cache locale e emetti immediatamente un conteggio di 0 per questo gruppo
      this.lastReadTimestampsForGroups.set(groupId, latestMessageTimestamp);
      this.recalculateAndEmitUnreadCount();

      console.log('--- END setCurrentActiveGroupChat ---');
    } catch (error) {
      console.error(`GroupChatNotificationService: Errore nel marcare i messaggi di gruppo come letti per ${groupId}:`, error);
      console.log('--- END setCurrentActiveGroupChat (con Errore) ---');
    }
  }

  private init() {
    const auth = getAuth();
    this.authSubscription = new Observable<FirebaseUser | null>(observer => {
      const unsubscribe = auth.onAuthStateChanged(user => observer.next(user));
      return unsubscribe;
    }).pipe(
      tap(user => this.currentUserId = user ? user.uid : null),
      switchMap(user => {
        if (!user) {
          this.unreadGroupCount$.next(0);
          this.groupMessagesSubscriptions.forEach(sub => sub.unsubscribe());
          this.groupMessagesSubscriptions.clear();
          this.lastNotifiedGroupMessageTimestamp.clear();
          this.lastReadTimestampsForGroups.clear();
          this.lastKnownGroups.clear();
          this.saveLastNotifiedTimestamps();
          this.hasInitialGroupsLoaded = false;
          return of(null);
        }
        return this.groupChatService.getGroupsForUser(user.uid).pipe(
          tap(groups => {
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
          map(groups => groups) // Passa i gruppi al prossimo switchMap
        );
      }),
      switchMap(groups => {
        if (!groups) {
          return of(0);
        }
        return combineLatest(groups.map(group =>
          this.groupChatService.getLastReadTimestamp(group.groupId!, this.currentUserId!).pipe(
            tap(lastReadTs => this.lastReadTimestampsForGroups.set(group.groupId!, lastReadTs)),
            switchMap(lastReadTs => {
              const queryTimestamp = lastReadTs || new Timestamp(0, 0);
              return from(this.groupChatService.countUnreadMessagesForGroup(group.groupId!, this.currentUserId!, queryTimestamp)).pipe(
                catchError(() => of(0))
              );
            }),
            catchError(() => of(0))
          )
        )).pipe(
          map(counts => counts.reduce((sum, current) => sum + current, 0)),
          distinctUntilChanged()
        );
      })
    ).subscribe({
      next: (totalUnread: number) => this.unreadGroupCount$.next(totalUnread),
      error: (err) => {
        console.error('GroupChatNotificationService: Errore nella pipeline principale (authSubscription):', err);
        this.unreadGroupCount$.next(0);
      }
    });
  }

  private manageGroupMessageListeners(currentGroups: GroupChat[]) {
    if (!this.currentUserId) return;
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
          tap(() => this.recalculateAndEmitUnreadCount()),
          catchError(() => of([]))
        ).subscribe(() => { }, err => console.error('GroupChatNotificationService: Errore nella sottoscrizione del gruppo (listener specifico):', err));
        this.groupMessagesSubscriptions.set(group.groupId!, subscription);
      }
    });
    this.saveLastNotifiedTimestamps();
  }

  public recalculateAndEmitUnreadCount() {
    if (!this.currentUserId) return;
    this.groupChatService.getGroupsForUser(this.currentUserId).pipe(
      take(1),
      switchMap(groups => {
        if (groups.length === 0) return of(0);
        return combineLatest(groups.map(group => {
          const lastReadTs = this.lastReadTimestampsForGroups.get(group.groupId!) || new Timestamp(0, 0);
          return from(this.groupChatService.countUnreadMessagesForGroup(group.groupId!, this.currentUserId!, lastReadTs)).pipe(
            catchError(() => of(0))
          );
        })).pipe(
          map(counts => counts.reduce((sum, current) => sum + current, 0)),
          distinctUntilChanged()
        );
      }),
      catchError(() => of(0))
    ).subscribe(totalUnread => this.unreadGroupCount$.next(totalUnread));
  }

  private async checkForNewGroupMessagesAndPlaySound(currentGroups: GroupChat[]) {
    if (!this.currentUserId) return;
    let shouldPlaySoundForAnyGroup = false;
    const newKnownGroups = new Map<string, GroupChat>();

    for (const group of currentGroups) {
      const lastKnownGroup = this.lastKnownGroups.get(group.groupId!);
      const isCurrentActiveGroupChat = this.currentActiveGroupChatId$.value === group.groupId!;
      const currentLastMessageTime = (group.lastMessage?.timestamp instanceof Timestamp) ? group.lastMessage.timestamp.toMillis() : 0;
      const lastKnownMessageTime = (lastKnownGroup?.lastMessage?.timestamp instanceof Timestamp) ? lastKnownGroup.lastMessage.timestamp.toMillis() : 0;
      const lastNotifiedTime = this.lastNotifiedGroupMessageTimestamp.get(group.groupId!) || 0;
      const senderId = group.lastMessage?.senderId;

      if (
        currentLastMessageTime > 0 &&
        senderId !== this.currentUserId &&
        !isCurrentActiveGroupChat &&
        currentLastMessageTime > lastKnownMessageTime &&
        currentLastMessageTime > lastNotifiedTime &&
        group.lastMessage?.text?.trim() !== ''
      ) {
        shouldPlaySoundForAnyGroup = true;
        this.lastNotifiedGroupMessageTimestamp.set(group.groupId!, currentLastMessageTime);
      }
      newKnownGroups.set(group.groupId!, group);
    }

    const currentTime = Date.now();
    if (shouldPlaySoundForAnyGroup && (currentTime - this.lastSoundPlayedTimestamp > this.minSoundInterval)) {
      this.playNotificationSound();
      this.lastSoundPlayedTimestamp = currentTime;
    }

    this.lastKnownGroups = newKnownGroups;
    this.saveLastNotifiedTimestamps();
  }

  private playNotificationSound() {
    this.audio.currentTime = 0;
    this.audio.play().catch(e => console.warn("GroupChatNotificationService: Errore durante la riproduzione del suono:", e));
  }

  getUnreadGroupCount$(): Observable<number> {
    return this.unreadGroupCount$.asObservable();
  }

  public getUnreadGroupCount(groupId: string, currentUserId: string): Observable<number> {
    return this.groupChatService.getLastReadTimestamp(groupId, currentUserId).pipe(
      switchMap(lastReadTs => {
        const queryTimestamp = lastReadTs || new Timestamp(0, 0);
        return from(this.groupChatService.countUnreadMessagesForGroup(groupId, currentUserId, queryTimestamp));
      }),
      distinctUntilChanged(),
      catchError(() => of(0))
    );
  }

  private saveLastNotifiedTimestamps() {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY_GROUP_TIMESTAMPS, JSON.stringify(Array.from(this.lastNotifiedGroupMessageTimestamp.entries())));
    } catch (e) {
      console.error('GroupChatNotificationService: Errore nel salvare lastNotifiedTimestamps nel localStorage:', e);
    }
  }

  private loadLastNotifiedTimestamps() {
    try {
      const savedData = localStorage.getItem(this.LOCAL_STORAGE_KEY_GROUP_TIMESTAMPS);
      if (savedData) {
        this.lastNotifiedGroupMessageTimestamp = new Map(JSON.parse(savedData));
      }
    } catch (e) {
      console.error('GroupChatNotificationService: Errore nel caricare lastNotifiedTimestamps dal localStorage:', e);
      this.lastNotifiedGroupMessageTimestamp = new Map();
    }
  }

  async initPushNotifications() {
    if (!isPlatform('capacitor') || this.pushNotificationsInitialized) return;
    this.pushNotificationsInitialized = true;
    let permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== 'granted') return;
    await PushNotifications.register();
    PushNotifications.addListener('registration', token => {
      this.ngZone.run(() => {
        this.fcmToken = token.value;
        if (this.currentUserId && this.fcmToken) {
          this.saveFcmTokenToFirestore(this.currentUserId, this.fcmToken);
        }
      });
    });
    PushNotifications.addListener('registrationError', error => this.ngZone.run(() => console.error('GroupChatNotificationService: Errore di registrazione Push:', error)));
    PushNotifications.addListener('pushNotificationReceived', notification => {
      this.ngZone.run(() => {
        if (notification.data && notification.data['groupId'] && this.router.url !== `/group-chat/${notification.data['groupId']}`) { }
      });
    });
    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      this.ngZone.run(() => {
        const data = action.notification.data;
        if (data && data['groupId']) this.router.navigateByUrl(`/group-chat/${data['groupId']}`);
      });
    });
  }

  private async saveFcmTokenToFirestore(userId: string, token: string): Promise<void> {
    if (!userId || !token) return;
    try {
      const userDocRef = doc(this.firestore, 'users', userId);
      await updateDoc(userDocRef, {
        fcmTokens: { [token]: true },
        lastLoginTokenUpdate: serverTimestamp()
      });
    } catch (error) {
      console.error(`GroupChatNotificationService: Errore nel salvare il token FCM per utente ${userId}:`, error);
    }
  }

  async markAllNotificationsAsRead() {
    const user = getAuth().currentUser;
    if (!user) return;
    try {
      const markPromises = Array.from(this.lastKnownGroups.keys()).map(groupId => this.groupChatService.markGroupMessagesAsRead(groupId, user.uid));
      await Promise.all(markPromises);
      this.unreadGroupCount$.next(0);
      this.lastNotifiedGroupMessageTimestamp.clear();
      this.saveLastNotifiedTimestamps();
    } catch (error) {
      console.error('GroupChatNotificationService: Errore nel marcare tutti i messaggi di gruppo come letti:', error);
    }
  }

  /**
   * Pulisce lo stato dei messaggi non letti per un gruppo specifico.
   * Utile per quando un utente abbandona un gruppo o lo rimuove dalla lista.
   * @param groupId L'ID del gruppo da cui rimuovere lo stato.
   */
  public clearUnreadForGroup(groupId: string): void {
    console.log(`GroupChatNotificationService: Pulisco lo stato non letto per il gruppo ${groupId}.`);
    // Rimuovi il gruppo dalle mappe che tracciano lo stato non letto
    this.groupMessagesSubscriptions.forEach((sub, id) => {
      if (id === groupId) {
        sub.unsubscribe();
        this.groupMessagesSubscriptions.delete(id);
        this.lastNotifiedGroupMessageTimestamp.delete(id);
        this.lastReadTimestampsForGroups.delete(id);
        this.lastKnownGroups.delete(id);
      }
    });

    // Salva lo stato nel localStorage
    this.saveLastNotifiedTimestamps();

    // Ricalcola il conteggio totale e aggiorna l'interfaccia utente
    this.recalculateAndEmitUnreadCount();
  }
}
