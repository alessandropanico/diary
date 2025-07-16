// src/app/services/chat-notification.service.ts

import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { PushNotifications } from '@capacitor/push-notifications';
import { BehaviorSubject, Observable, Subscription, from, of, forkJoin } from 'rxjs';
import { getAuth, User as FirebaseUser } from 'firebase/auth';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { switchMap, tap, map, catchError, distinctUntilChanged } from 'rxjs/operators';

// !!! Importa la tua classe ChatService reale da dove si trova !!!
// Sostituisci questo import con il percorso corretto del tuo ChatService
import { ChatService, ConversationDocument } from './chat.service'; // Esempio: Assumi che ChatService e ConversationDocument siano qui

// Rimuovi l'interfaccia ChatServiceContract da qui, non serve più per l'iniezione

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

  private lastKnownConversations: { [chatId: string]: ConversationDocument } = {};

  private currentActiveChatId: string | null = null;

  // !!! INIETTA LA CLASSE CHATSERVICE REALE, NON L'INTERFACCIA !!!
  constructor(private chatService: ChatService, private router: Router) { // <--- MODIFICATO QUI
    this.audio = new Audio('assets/sound/notification.mp3');
    this.init();
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    this.setCurrentActiveChat(null);
  }

  public setCurrentActiveChat(chatId: string | null) {
    this.currentActiveChatId = chatId;
    if (this.currentUserId && this.currentActiveChatId) {
      this.chatService.markMessagesAsRead(this.currentActiveChatId, this.currentUserId)
        .catch((error: any) => console.error('Errore nel marcare i messaggi come letti all\'ingresso chat:', error));
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
          return this.chatService.getUserConversations(this.currentUserId).pipe(
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
          this.lastKnownConversations = {};
          this.currentActiveChatId = null;
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
    if (!this.currentUserId) {
      this.lastKnownConversations = {};
      return;
    }

    let shouldPlaySound = false;
    const newKnownConversations: { [chatId: string]: ConversationDocument } = {};

    for (const conv of currentConversations) {
      const lastKnownConv = this.lastKnownConversations[conv.id];

      const isCurrentActiveChat = this.currentActiveChatId && (this.currentActiveChatId === conv.id);

      if (
        conv.lastMessageAt &&
        conv.lastMessageSenderId !== this.currentUserId &&
        !isCurrentActiveChat &&
        (
          !lastKnownConv ||
          conv.lastMessageAt.toMillis() > (lastKnownConv.lastMessageAt?.toMillis() || 0)
        )
      ) {
        shouldPlaySound = true;
      }
      newKnownConversations[conv.id] = conv;
    }

    const currentTime = Date.now();
    if (shouldPlaySound && (currentTime - this.lastSoundPlayedTimestamp > this.minSoundInterval)) {
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
}
