// src/app/services/chat-notification.service.ts

import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { PushNotifications } from '@capacitor/push-notifications'; // Non utilizzato in questo servizio specifico, potresti rimuoverlo se non necessario altrove
import { BehaviorSubject, Observable, Subscription, from, of, forkJoin } from 'rxjs';
import { getAuth, User as FirebaseUser } from 'firebase/auth';
import { doc, getFirestore, setDoc } from 'firebase/firestore'; // Non utilizzati in questo servizio specifico, potresti rimuoverli se non necessari altrove
import { switchMap, tap, map, catchError, distinctUntilChanged } from 'rxjs/operators';
import { ChatService, ConversationDocument } from './chat.service'; // Assicurati che il percorso sia corretto e che ChatService sia iniettabile

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
  private minSoundInterval: number = 2000; // Intervallo minimo tra i suoni (2 secondi)

  private lastKnownConversations = new Map<string, ConversationDocument>();
  private lastNotifiedTimestamp: Map<string, number> = new Map(); // Tiene traccia dell'ultimo timestamp notificato per chat

  // Chiave per localStorage per la persistenza
  private readonly LOCAL_STORAGE_KEY = 'chatNotificationLastNotifiedTimestamps';

  private currentActiveChatId: string | null = null;

  constructor(private chatService: ChatService, private router: Router) {
    this.audio = new Audio('assets/sound/notification.mp3');
    this.loadLastNotifiedTimestamps(); // **Carica lo stato precedente all'avvio del servizio**
    this.init();
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    this.saveLastNotifiedTimestamps(); // **Salva lo stato quando il servizio viene distrutto (es. app chiusa)**
    this.setCurrentActiveChat(null); // Assicurati di pulire lo stato della chat attiva
  }

  public setCurrentActiveChat(chatId: string | null) {
    this.currentActiveChatId = chatId;
    console.log(`ChatNotificationService: Chat attiva impostata a: ${chatId}`);

    if (this.currentUserId && this.currentActiveChatId) {
      this.chatService.markMessagesAsRead(this.currentActiveChatId, this.currentUserId)
        .catch((error: any) => console.error('Errore nel marcare i messaggi come letti all\'ingresso chat:', error));

      if (chatId) {
        // Quando entriamo in una chat specifica, "dimentichiamo" l'ultimo messaggio notificato
        // per quella chat. Questo permette al suono di riattivarsi se arrivano nuovi messaggi
        // dopo che siamo usciti e rientrati (o se l'app è in background).
        this.lastNotifiedTimestamp.delete(chatId);
        this.saveLastNotifiedTimestamps(); // **Salva subito dopo la modifica**
      }
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
          console.log('ChatNotificationService: Ascolto conversazioni per utente:', this.currentUserId);
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
          // Utente disconnesso, resetta tutto
          this.unreadMessages = {};
          this.unreadCount$.next(0);
          this.lastKnownConversations.clear();
          this.currentActiveChatId = null;
          this.lastNotifiedTimestamp.clear(); // Resetta la mappa al logout
          this.saveLastNotifiedTimestamps(); // **Salva lo stato vuoto al logout**
          console.log('User logged out, resetting notification state.');
          return of(0);
        }
      })
    ).subscribe({
      next: (totalUnread: number) => {
        this.unreadCount$.next(totalUnread);
        console.log('ChatNotificationService: unreadCount$ aggiornato a:', totalUnread);
      },
      error: (err) => {
        console.error('ChatNotificationService: Errore nella pipeline principale (authSubscription):', err);
        this.unreadCount$.next(0);
      }
    });
  }

  /**
   * Controlla se ci sono nuovi messaggi dall'altro utente e riproduce un suono.
   * @param currentConversations L'array corrente di ConversationDocument.
   */
  private async checkForNewMessagesAndPlaySound(currentConversations: ConversationDocument[]) {
    if (!this.currentUserId) {
      this.lastKnownConversations.clear();
      this.lastNotifiedTimestamp.clear();
      this.saveLastNotifiedTimestamps(); // **Salva lo stato vuoto se non c'è utente**
      return;
    }

    let shouldPlaySoundForAnyChat = false;
    const newKnownConversations = new Map<string, ConversationDocument>();

    for (const conv of currentConversations) {
      const lastKnownConv = this.lastKnownConversations.get(conv.id);
      const isCurrentActiveChat = this.currentActiveChatId && (this.currentActiveChatId === conv.id);

      const currentLastMessageTime = conv.lastMessageAt?.toMillis() || 0;
      const lastKnownMessageTime = lastKnownConv?.lastMessageAt?.toMillis() || 0;
      const lastNotifiedTime = this.lastNotifiedTimestamp.get(conv.id) || 0;

      // Condizioni per riprodurre il suono:
      // 1. C'è un ultimo messaggio (timestamp > 0).
      // 2. L'ultimo messaggio non è stato inviato dall'utente corrente.
      // 3. L'utente NON è nella chat attiva (per non suonare mentre si sta leggendo).
      // 4. L'ultimo messaggio è più recente di quello che conoscevamo dalla sessione precedente
      //    (o è la prima volta che vediamo questa conversazione).
      // 5. IL MESSAGGIO È PIÙ RECENTE DELL'ULTIMO PER CUI ABBIAMO GIÀ SUONATO (chiave per la persistenza).
      if (
        conv.lastMessageAt &&
        conv.lastMessageSenderId !== this.currentUserId &&
        !isCurrentActiveChat &&
        currentLastMessageTime > lastKnownMessageTime &&
        currentLastMessageTime > lastNotifiedTime
      ) {
        shouldPlaySoundForAnyChat = true;
        // IMPORTANTE: Aggiorna lastNotifiedTimestamp per questa specifica chat
        // in modo che non suoni più per questo stesso messaggio.
        this.lastNotifiedTimestamp.set(conv.id, currentLastMessageTime);
        this.saveLastNotifiedTimestamps(); // **Salva subito dopo aver deciso di suonare**
      }
      newKnownConversations.set(conv.id, conv);
    }

    const currentTime = Date.now();
    // Riproduce il suono solo se:
    // 1. Almeno una chat ha soddisfatto le condizioni di notifica.
    // 2. È passato un intervallo di tempo minimo dall'ultimo suono globale.
    if (shouldPlaySoundForAnyChat && (currentTime - this.lastSoundPlayedTimestamp > this.minSoundInterval)) {
      this.playNotificationSound();
      this.lastSoundPlayedTimestamp = currentTime;
    }

    // Aggiorna sempre la lastKnownConversations per il prossimo ciclo di controllo
    this.lastKnownConversations = newKnownConversations;
  }

  private playNotificationSound() {
    this.audio.currentTime = 0; // Riproduci dall'inizio
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
    console.log(`ChatNotificationService: Incrementato unread per ${chatId} a ${this.unreadMessages[chatId]}`);
  }

  clearUnread(chatId: string) {
    delete this.unreadMessages[chatId];
    console.log(`ChatNotificationService: Azzerato unread per ${chatId}`);
  }


  private saveLastNotifiedTimestamps() {
    try {
      // Converte la Map in un array di array per la serializzazione JSON
      // Esempio: [[chatId1, timestamp1], [chatId2, timestamp2]]
      const dataToSave = Array.from(this.lastNotifiedTimestamp.entries());
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
      console.log('ChatNotificationService: lastNotifiedTimestamps salvato nel localStorage.');
    } catch (e) {
      console.error('ChatNotificationService: Errore nel salvare lastNotifiedTimestamps nel localStorage:', e);
    }
  }

  private loadLastNotifiedTimestamps() {
    try {
      const savedData = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (savedData) {
        // Parsa la stringa JSON e la riconverte in una Map
        const parsedData: [string, number][] = JSON.parse(savedData);
        this.lastNotifiedTimestamp = new Map(parsedData);
        console.log('ChatNotificationService: lastNotifiedTimestamps caricato dal localStorage.');
      }
    } catch (e) {
      console.error('ChatNotificationService: Errore nel caricare lastNotifiedTimestamps dal localStorage:', e);
      // In caso di errore (es. dati corrotti), resetta la mappa per evitare comportamenti anomali
      this.lastNotifiedTimestamp = new Map();
    }
  }
}
