// src/app/services/chat-notification.service.ts

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, Observable, forkJoin, from, of } from 'rxjs';
import { getAuth, User as FirebaseUser } from 'firebase/auth';
import { ChatService, ConversationDocument } from './chat.service';
import { map, switchMap, tap, catchError, distinctUntilChanged } from 'rxjs/operators';
import { Timestamp } from 'firebase/firestore';

interface UnreadMessagesMap {
  [chatId: string]: number;
}

@Injectable({ providedIn: 'root' })
export class ChatNotificationService implements OnDestroy {
  private unreadMessages: UnreadMessagesMap = {};
  private unreadCount$ = new BehaviorSubject<number>(0);

  private authSubscription: Subscription | undefined;
  private currentUserId: string | null = null;
  private audio: HTMLAudioElement;

  private lastSoundPlayedTimestamp: number = 0;
  private minSoundInterval: number = 2000; // Intervallo minimo tra i suoni (2 secondi)

  // Variabile per tenere traccia dello stato precedente delle conversazioni per la riproduzione del suono
  private lastKnownConversations: { [chatId: string]: ConversationDocument } = {};

  // NUOVA VARIABILE: Traccia l'ID della chat attualmente attiva (quella in cui si trova l'utente)
  private currentActiveChatId: string | null = null; // <--- AGGIUNTA QUESTA LINEA

  constructor(private chatService: ChatService) {
    this.audio = new Audio('assets/sound/notification.mp3');
    this.init();
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  // NUOVO METODO: Per impostare la chat attiva
  public setCurrentActiveChat(chatId: string | null) { // <--- AGGIUNTA QUESTO METODO
    this.currentActiveChatId = chatId;
    console.log(`ChatNotificationService: Chat attiva impostata a: ${chatId}`);

    // Se l'utente entra in una chat, forziamo un aggiornamento dello stato "letto"
    // per quella conversazione, nel caso ci fossero messaggi non letti.
    // Questo è un buon punto per assicurarsi che i badge di notifica si aggiornino rapidamente.
    if (this.currentUserId && this.currentActiveChatId) {
      this.chatService.markMessagesAsRead(this.currentActiveChatId, this.currentUserId)
        .catch(error => console.error('Errore nel marcare i messaggi come letti all\'ingresso chat:', error));
    }
  }

  private init() {
    this.authSubscription = new Observable<FirebaseUser | null>(observer => {
      const auth = getAuth();
      const unsubscribe = auth.onAuthStateChanged(user => {
        observer.next(user);
      });
      return unsubscribe;
    }).pipe(
      tap(user => {
        this.currentUserId = user ? user.uid : null;
        if (!this.currentUserId) {
          this.unreadMessages = {};
          this.unreadCount$.next(0);
          this.lastKnownConversations = {};
          this.currentActiveChatId = null; // Reset anche della chat attiva
        }
      }),
      switchMap(user => {
        if (user && user.uid) {
          console.log('ChatNotificationService: Ascolto conversazioni per utente:', user.uid);
          return this.chatService.getUserConversations(user.uid).pipe(
            // **TAP per la riproduzione del suono:**
            // Questo `tap` esegue un'azione secondaria (controllare e riprodurre il suono)
            // ogni volta che l'elenco delle conversazioni cambia.
            tap((conversations: ConversationDocument[]) => this.checkForNewMessagesAndPlaySound(conversations)),
            // **SWITCHMAP per il calcolo del conteggio totale dei messaggi non letti:**
            // Dopo aver gestito il suono, passiamo al calcolo effettivo dei messaggi non letti.
            switchMap((conversations: ConversationDocument[]) => {
              if (conversations.length === 0) {
                return of(0);
              }

              const unreadCountsObservables: Observable<number>[] = conversations.map(conv => {
                const lastReadByMe: Timestamp | null = conv.lastRead?.[user.uid!] ?? null;
                return from(this.chatService.countUnreadMessages(conv.id, user.uid!, lastReadByMe)).pipe(
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
          return of(0);
        }
      })
    ).subscribe({
      next: (totalUnread: number) => {
        this.unreadCount$.next(totalUnread);
        console.log('ChatNotificationService: unreadCount$ aggiornato a:', totalUnread);
      },
      error: (err) => {
        console.error('ChatNotificationService: Errore nella pipeline principale:', err);
        this.unreadCount$.next(0);
      }
    });
  }

  /**
   * Controlla se ci sono nuovi messaggi dall'altro utente e riproduce un suono.
   * Viene chiamato ogni volta che l'elenco delle conversazioni viene aggiornato da Firebase.
   * @param currentConversations L'array corrente di ConversationDocument.
   */
  private async checkForNewMessagesAndPlaySound(currentConversations: ConversationDocument[]) {
    if (!this.currentUserId) {
      this.lastKnownConversations = {};
      return;
    }

    let shouldPlaySound = false;

    // Mappa per i nuovi stati delle conversazioni da salvare alla fine
    const newKnownConversations: { [chatId: string]: ConversationDocument } = {};

    for (const conv of currentConversations) {
      const lastKnownConv = this.lastKnownConversations[conv.id];

      // Controlla se la conversazione non è quella attiva attualmente
      const isCurrentActiveChat = this.currentActiveChatId && (this.currentActiveChatId === conv.id);

      // Condizione per riprodurre il suono:
      // 1. Esiste un ultimo messaggio (`conv.lastMessageAt`).
      // 2. Il mittente dell'ultimo messaggio NON è l'utente attualmente loggato (`conv.lastMessageSenderId !== this.currentUserId`).
      // 3. La conversazione non è quella attiva (l'utente non è già dentro).
      // 4. L'ultimo messaggio è più recente rispetto a quello che conoscevamo O è una nuova conversazione.
      if (
        conv.lastMessageAt &&
        conv.lastMessageSenderId !== this.currentUserId &&
        !isCurrentActiveChat && // <--- CONDIZIONE CHIAVE: NON SUONARE SE L'UTENTE È NELLA CHAT
        (
          !lastKnownConv || // È una nuova conversazione (mai vista prima)
          conv.lastMessageAt.toMillis() > (lastKnownConv.lastMessageAt?.toMillis() || 0) // L'ultimo messaggio è più recente
        )
      ) {
        shouldPlaySound = true;
        // Non usiamo `break` qui per garantire che `newKnownConversations` venga aggiornato con tutte le conv.
      }
      // Aggiorna la mappa temporanea per il prossimo ciclo
      newKnownConversations[conv.id] = conv;
    }

    const currentTime = Date.now();
    if (shouldPlaySound && (currentTime - this.lastSoundPlayedTimestamp > this.minSoundInterval)) {
      this.playNotificationSound();
      this.lastSoundPlayedTimestamp = currentTime;
    }

    // Aggiorna lo stato delle conversazioni conosciute alla fine del ciclo.
    // Questo è cruciale per prevenire suoni ripetuti quando i dati di Firebase si rileggono
    // ma non ci sono effettivamente nuovi messaggi dall'altro utente.
    this.lastKnownConversations = newKnownConversations;
  }

  private playNotificationSound() {
    this.audio.currentTime = 0;
    this.audio.play().catch(e => console.warn("Errore durante la riproduzione del suono (ChatNotificationService):", e));
  }

  getUnreadCount$(): Observable<number> {
    return this.unreadCount$.asObservable();
  }

  getUnreadCountForChat(chatId: string): number {
    return this.unreadMessages[chatId] || 0;
  }

  incrementUnread(chatId: string) {
    this.unreadMessages[chatId] = (this.unreadMessages[chatId] || 0) + 1;
    console.log(`ChatNotificationService: Incrementato unread per ${chatId} a ${this.unreadMessages[chatId]}`);
  }

  clearUnread(chatId: string) {
    delete this.unreadMessages[chatId];
    console.log(`ChatNotificationService: Azzerato unread per ${chatId}`);
  }
}
