// src/app/services/chat-notification.service.ts

import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, from, of, forkJoin } from 'rxjs';
import { getAuth, User as FirebaseUser } from 'firebase/auth';
import { switchMap, tap, map, catchError, distinctUntilChanged } from 'rxjs/operators';
import { Timestamp, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

import { ChatService, ConversationDocument } from './chat.service';

import { PushNotifications, PushNotificationSchema, PermissionStatus } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { isPlatform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ChatNotificationService implements OnDestroy {

  private unreadMessages: { [chatId: string]: number } = {};
  private unreadCount$ = new BehaviorSubject<number>(0);

  private authSubscription: Subscription | undefined;
  private currentUserId: string | null = null;
  private audio: HTMLAudioElement;

  private lastSoundPlayedTimestamp: number = 0;
  private minSoundInterval: number = 2000;

  private lastKnownConversations = new Map<string, ConversationDocument>();
  private lastNotifiedTimestamp: Map<string, number> = new Map();

  private readonly LOCAL_STORAGE_KEY_TIMESTAMPS = 'chatNotificationLastNotifiedTimestamps';

  private currentActiveChatId: string | null = null;

  private fcmToken: string | null = null;
  private pushNotificationsInitialized = false;

  private hasInitialConversationsLoaded = false;

  // ⭐⭐ NUOVO: Mappa per tracciare lo stato di silenziamento localmente ⭐⭐
  private mutedStatus = new BehaviorSubject<Map<string, boolean>>(new Map<string, boolean>());


  constructor(
    private chatService: ChatService,
    private router: Router,
    private ngZone: NgZone
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
    this.setCurrentActiveChat(null);

    if (isPlatform('capacitor')) {
      PushNotifications.removeAllListeners();
    }
  }

  public setCurrentActiveChat(chatId: string | null) {
    this.currentActiveChatId = chatId;
    if (this.currentUserId && this.currentActiveChatId) {
      this.chatService.markMessagesAsRead(this.currentActiveChatId, this.currentUserId)
        .catch((error: any) => console.error('Errore nel marcare i messaggi come letti all\'ingresso chat:', error));

      // Se entro in una chat, resetto il timestamp di notifica per quella chat
      this.lastNotifiedTimestamp.delete(this.currentActiveChatId);
      this.saveLastNotifiedTimestamps();
    }
  }

  public setChatMuteStatus(chatId: string, isMuted: boolean) {
    const currentStatus = this.mutedStatus.getValue();
    currentStatus.set(chatId, isMuted);
    this.mutedStatus.next(currentStatus);
    console.log(`[ChatNotification] Stato locale aggiornato per chat ${chatId}: ${isMuted}`);
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
          return this.chatService.getUserConversations(this.currentUserId).pipe(
            // ⭐ AGGIORNATO: Prima di filtrare, popoliamo lo stato di silenziamento nel servizio.
            tap((conversations: ConversationDocument[]) => {
              conversations.forEach(conv => {
                if (conv.mutedBy && this.currentUserId) {
                  this.setChatMuteStatus(conv.id, conv.mutedBy.includes(this.currentUserId));
                }
              });
            }),
            map((conversations: ConversationDocument[]) =>
              conversations.filter(conv => {
                const isDeleted = conv.deletedBy?.includes(this.currentUserId!);
                return !isDeleted;
              })
            ),
            tap((conversations: ConversationDocument[]) => {
              if (!this.hasInitialConversationsLoaded) {
                conversations.forEach(conv => {
                  this.lastKnownConversations.set(conv.id, conv);
                });
                this.saveLastNotifiedTimestamps();
                this.hasInitialConversationsLoaded = true;
              }
            }),
            tap((conversations: ConversationDocument[]) => this.checkForNewMessagesAndPlaySound(conversations)),
            switchMap((conversations: ConversationDocument[]) => {
              if (conversations.length === 0) {
                return of(0);
              }

              const unreadCountsObservables: Observable<number>[] = conversations.map(conv => {
                const lastReadByMe = conv.lastRead?.[this.currentUserId!] ?? null;
                return from(this.chatService.countUnreadMessages(conv.id, this.currentUserId!, lastReadByMe)).pipe(
                  catchError(err => {
                    console.error(`Errore nel conteggio messaggi non letti per chat ${conv.id}:`, err);
                    return of(0);
                  })
                );
              });

              return forkJoin(unreadCountsObservables).pipe(
                map(counts => counts.reduce((sum, current) => sum + current, 0)),
                distinctUntilChanged(),
                tap(total => console.log('ChatNotificationService: Totale messaggi non letti calcolato:', total)),
                catchError(err => {
                  console.error('ChatNotificationService: Errore durante la somma dei messaggi non letti:', err);
                  return of(0);
                })
              );
            }),
            catchError(err => {
              console.error('ChatNotificationService: Errore nel recupero delle conversazioni:', err);
              return of(0);
            })
          );
        } else {
          this.unreadMessages = {};
          this.unreadCount$.next(0);
          this.lastKnownConversations.clear();
          this.lastNotifiedTimestamp.clear();
          this.saveLastNotifiedTimestamps();
          this.hasInitialConversationsLoaded = false;
          return of(0);
        }
      })
    ).subscribe({
      next: (totalUnread: number) => {
        this.unreadCount$.next(totalUnread);
      },
      error: (err) => {
        console.error('ChatNotificationService: Errore nella pipeline principale (authSubscription):', err);
        this.unreadCount$.next(0);
      }
    });
  }


  private async checkForNewMessagesAndPlaySound(currentConversations: ConversationDocument[]) {
    if (!this.hasInitialConversationsLoaded || !this.currentUserId) {
      currentConversations.forEach(conv => {
        this.lastKnownConversations.set(conv.id, conv);
      });
      this.hasInitialConversationsLoaded = true;
      return;
    }

    let shouldPlaySoundForAnyChat = false;
    const newKnownConversations = new Map<string, ConversationDocument>();

    for (const conv of currentConversations) {
      const lastKnownConv = this.lastKnownConversations.get(conv.id);
      const isCurrentActiveChat = this.currentActiveChatId && (this.currentActiveChatId === conv.id);

      const currentLastMessageTime = (conv.lastMessageAt instanceof Timestamp) ? conv.lastMessageAt.toMillis() : 0;
      const lastKnownMessageTime = (lastKnownConv?.lastMessageAt instanceof Timestamp) ? lastKnownConv.lastMessageAt.toMillis() : 0;

      // ⭐⭐ AGGIORNATO: Usa il metodo isChatMuted() del servizio per il controllo ⭐⭐
      const isMuted = this.isChatMuted(conv.id);

      // Log di debug
      console.log(`[ChatNotification] Chat ID: ${conv.id}, Muted Status: ${isMuted}`);
      console.log(`[ChatNotification] Last Message Time (Current): ${currentLastMessageTime}, Last Message Time (Last Known): ${lastKnownMessageTime}`);

      // La logica per rilevare un nuovo messaggio:
      if (
        currentLastMessageTime > 0 &&
        conv.lastMessageSenderId !== this.currentUserId &&
        !isCurrentActiveChat &&
        currentLastMessageTime > lastKnownMessageTime &&
        conv.lastMessage && conv.lastMessage.trim() !== ''
      ) {
        console.log(`[ChatNotification] Nuovo messaggio rilevato in chat ${conv.id}`);

        // ⭐⭐ AGGIORNATO: Suona SOLO se la chat NON è muta, in base al controllo del servizio. ⭐⭐
        if (!isMuted) {
          console.log(`[ChatNotification] Condizioni di suono soddisfatte per chat ${conv.id}.`);
          shouldPlaySoundForAnyChat = true;
        } else {
          console.log(`[ChatNotification] Chat ${conv.id} silenziata, suono bloccato.`);
        }
      }
      newKnownConversations.set(conv.id, conv);
    }

    const currentTime = Date.now();
    if (shouldPlaySoundForAnyChat && (currentTime - this.lastSoundPlayedTimestamp > this.minSoundInterval)) {
      this.playNotificationSound();
      this.lastSoundPlayedTimestamp = currentTime;
    }

    this.lastKnownConversations = newKnownConversations;
  }

  private playNotificationSound() {
    this.audio.currentTime = 0;
    this.audio.play().catch((e: any) => console.warn("Errore durante la riproduzione del suono (ChatNotificationService):", e));
  }

  getUnreadCount$(): Observable<number> {
    return this.unreadCount$.asObservable();
  }

  getUnreadCountForChat(chatId: string): number {
    return this.unreadMessages[chatId] || 0;
  }

  incrementUnread(chatId: string) {
    this.unreadMessages[chatId] = (this.unreadMessages[chatId] || 0) + 1;
  }

  clearUnread(chatId: string) {
    delete this.unreadMessages[chatId];
  }

  private saveLastNotifiedTimestamps() {
    try {
      const dataToSave = Array.from(this.lastNotifiedTimestamp.entries());
      localStorage.setItem(this.LOCAL_STORAGE_KEY_TIMESTAMPS, JSON.stringify(dataToSave));
    } catch (e) {
      console.error('ChatNotificationService: Errore nel salvare lastNotifiedTimestamps nel localStorage:', e);
    }
  }

  private loadLastNotifiedTimestamps() {
    try {
      const savedData = localStorage.getItem(this.LOCAL_STORAGE_KEY_TIMESTAMPS);
      if (savedData) {
        const parsedData: [string, number][] = JSON.parse(savedData);
        this.lastNotifiedTimestamp = new Map(parsedData);
      }
    } catch (e) {
      console.error('ChatNotificationService: Errore nel caricare lastNotifiedTimestamps dal localStorage:', e);
      this.lastNotifiedTimestamp = new Map();
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
      console.warn('ChatNotificationService: Permessi di notifica non concessi. Impossibile ricevere push.');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', token => {
      this.ngZone.run(() => {
        this.fcmToken = token.value;
        if (this.currentUserId && this.fcmToken) {
          this.saveFcmTokenToFirestore(this.currentUserId, this.fcmToken);
        } else {
          console.warn('ChatNotificationService: Impossibile salvare il token FCM. Utente non loggato o token nullo.');
        }
      });
    });

    PushNotifications.addListener('registrationError', error => {
      this.ngZone.run(() => {
        console.error('ChatNotificationService: Errore di registrazione Push:', error);
      });
    });

    PushNotifications.addListener('pushNotificationReceived', notification => {
      this.ngZone.run(() => {
        if (notification.data && notification.data['chatId'] && this.router.url !== `/chat/${notification.data['chatId']}`) {
          // Logica per visualizzare una notifica in-app se l'app è in foreground
          // Ad esempio, potresti usare un toast o un alert
          // if (isPlatform('web') || !isPlatform('capacitor')) {
          //   // Solo per web, dato che su mobile le notifiche sono gestite dal sistema
          //   alert(`Nuovo messaggio da ${notification.title}: ${notification.body}`);
          // }
        }
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      this.ngZone.run(() => {
        const data = action.notification.data;
        if (data && data['chatId']) {
          this.router.navigateByUrl(`/chat/${data['chatId']}`);
        }
      });
    });
    App.addListener('appStateChange', ({ isActive }) => {
      // Se l'app torna in foreground e abbiamo un utente loggato, possiamo ricaricare le conversazioni
      // per assicurarci che lo stato delle notifiche sia aggiornato.
      if (isActive && this.currentUserId) {
        // Il pipe in init() dovrebbe già reagire all'attività dell'observable
        // this.init(); // NON CHIAMARE INIT QUI, potrebbe creare sottoscrizioni duplicate.
        // L'Observer in init() si occuperà di reagire al cambiamento di stato di auth.
      }
    });
  }

  private async saveFcmTokenToFirestore(userId: string, token: string): Promise<void> {
    if (!userId || !token) {
      console.warn('ChatNotificationService: Impossibile salvare token FCM. userId o token sono nulli.');
      return;
    }
    try {
      const userDocRef = doc(this.chatService.afs, 'users', userId);
      await updateDoc(userDocRef, {
        fcmTokens: {
          [token]: true
        },
        lastLoginTokenUpdate: serverTimestamp()
      });
    } catch (error) {
      console.error(`ChatNotificationService: Errore nel salvare il token FCM per utente ${userId}:`, error);
    }
  }

  public isChatMuted(chatId: string): boolean {
    return this.mutedStatus.getValue().get(chatId) || false;
  }
}
