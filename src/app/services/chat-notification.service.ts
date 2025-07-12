// src/app/services/chat-notification.service.ts

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, Observable, forkJoin, from, of } from 'rxjs'; // Aggiungi forkJoin, from, of
import { getAuth, User as FirebaseUser } from 'firebase/auth';
import { ChatService, ConversationDocument } from './chat.service';
import { map, switchMap, tap, catchError, distinctUntilChanged } from 'rxjs/operators'; // Aggiungi catchError, distinctUntilChanged
import { Timestamp } from 'firebase/firestore';

interface UnreadMessagesMap {
  [chatId: string]: number;
}

@Injectable({ providedIn: 'root' })
export class ChatNotificationService implements OnDestroy {
  // `unreadMessages` è mantenuto per compatibilità esterna, ma non guida il conteggio globale.
  private unreadMessages: UnreadMessagesMap = {};
  private unreadCount$ = new BehaviorSubject<number>(0);

  private authSubscription: Subscription | undefined;
  // `conversationsSubscription` non è più necessaria come sottoscrizione separata qui,
  // la gestione è inline nello `switchMap` della pipeline RxJS.
  // private conversationsSubscription: Subscription | undefined;
  private currentUserId: string | null = null;
  private audio: HTMLAudioElement;

  private lastSoundPlayedTimestamp: number = 0;
  private minSoundInterval: number = 2000; // Intervallo minimo tra i suoni (2 secondi)

  // Variabile per tenere traccia dello stato precedente delle conversazioni per la riproduzione del suono
  private lastKnownConversations: { [chatId: string]: ConversationDocument } = {};

  constructor(private chatService: ChatService) {
    this.audio = new Audio('assets/sound/notification.mp3');
    this.init(); // Inizializza il servizio all'avvio
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    // Rimuovi `conversationsSubscription` se non la usi più
    // if (this.conversationsSubscription) {
    //   this.conversationsSubscription.unsubscribe();
    // }
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
          // Se l'utente si disconnette, resetta il conteggio e lo stato delle conversazioni
          this.unreadMessages = {}; // Reset della mappa interna (se ancora usata altrove)
          this.unreadCount$.next(0);
          this.lastKnownConversations = {}; // Resetta anche per il suono
        }
      }),
      // **Logica principale del servizio:**
      // Una volta che l'utente è loggato, avvia l'ascolto delle conversazioni
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
                return of(0); // Nessuna conversazione, 0 messaggi non letti
              }

              // Crea un array di Observable, uno per ogni chiamata a countUnreadMessages
              const unreadCountsObservables: Observable<number>[] = conversations.map(conv => {
                const lastReadByMe: Timestamp | null = conv.lastRead?.[user.uid!] ?? null;
                // Converte la Promise di countUnreadMessages in un Observable con `from()`
                return from(this.chatService.countUnreadMessages(conv.id, user.uid!, lastReadByMe)).pipe(
                  catchError(err => {
                    console.error(`Errore nel conteggio messaggi non letti per chat ${conv.id}:`, err);
                    return of(0); // In caso di errore per una singola chat, considera 0
                  })
                );
              });

              // Usa forkJoin per attendere che tutti gli Observable di conteggio si completino,
              // poi somma i risultati.
              return forkJoin(unreadCountsObservables).pipe(
                map(counts => counts.reduce((sum, current) => sum + current, 0)),
                // `distinctUntilChanged()`: Emette solo quando il valore totale cambia,
                // riducendo gli aggiornamenti ridondanti.
                distinctUntilChanged(),
                tap(total => console.log('ChatNotificationService: Totale messaggi non letti calcolato:', total)),
                catchError(err => {
                  console.error('ChatNotificationService: Errore durante la somma dei messaggi non letti:', err);
                  return of(0); // In caso di errore nella somma, resetta a 0
                })
              );
            }),
            catchError(err => {
              console.error('ChatNotificationService: Errore nel recupero delle conversazioni:', err);
              return of(0); // In caso di errore nel recupero delle conversazioni, considera 0
            })
          );
        } else {
          return of(0); // Utente non loggato, 0 messaggi non letti
        }
      })
    ).subscribe({
      next: (totalUnread: number) => {
        // Aggiorna il BehaviorSubject pubblico con il conteggio totale
        this.unreadCount$.next(totalUnread);
        console.log('ChatNotificationService: unreadCount$ aggiornato a:', totalUnread);
      },
      error: (err) => {
        console.error('ChatNotificationService: Errore nella pipeline principale:', err);
        this.unreadCount$.next(0); // Reset in caso di errore critico
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
      this.lastKnownConversations = {}; // Reset se l'utente si è disconnesso
      return;
    }

    let shouldPlaySound = false;

    for (const conv of currentConversations) {
      const lastKnownConv = this.lastKnownConversations[conv.id];

      // Condizione per riprodurre il suono:
      // 1. Esiste un ultimo messaggio (`conv.lastMessageAt`).
      // 2. Il `lastMessageAt` della conversazione corrente è più recente
      //    rispetto al `lastMessageAt` dell'ultima versione conosciuta della conversazione,
      //    OPPURE è una nuova conversazione che non conoscevamo prima (`!lastKnownConv`).
      // 3. Il mittente dell'ultimo messaggio NON è l'utente attualmente loggato (`conv.lastMessageSenderId !== this.currentUserId`).
      if (
        conv.lastMessageAt &&
        (
          !lastKnownConv ||
          conv.lastMessageAt.toMillis() > (lastKnownConv.lastMessageAt?.toMillis() || 0)
        ) &&
        conv.lastMessageSenderId !== this.currentUserId
      ) {
        // Trovato almeno un nuovo messaggio non inviato da me.
        shouldPlaySound = true;
        // Non usiamo `break` qui per garantire che `lastKnownConversations` venga aggiornato con tutte le conv.
      }
    }

    // Riproduci il suono solo se `shouldPlaySound` è vero
    // e se è passato l'intervallo minimo dall'ultima riproduzione.
    const currentTime = Date.now();
    if (shouldPlaySound && (currentTime - this.lastSoundPlayedTimestamp > this.minSoundInterval)) {
      this.playNotificationSound();
      this.lastSoundPlayedTimestamp = currentTime; // Aggiorna il timestamp dell'ultima riproduzione
    }

    // Aggiorna lo stato delle conversazioni conosciute *dopo* aver fatto il controllo del suono
    // per il prossimo ciclo del `tap`.
    this.lastKnownConversations = currentConversations.reduce((acc, conv) => {
      acc[conv.id] = conv;
      return acc;
    }, {} as { [chatId: string]: ConversationDocument });
  }

  /**
   * Riproduce il suono di notifica.
   */
  private playNotificationSound() {
    this.audio.currentTime = 0; // Riposiziona l'audio all'inizio per riprodurlo di nuovo
    this.audio.play().catch(e => console.warn("Errore durante la riproduzione del suono (ChatNotificationService):", e));
  }

  /**
   * Fornisce un Observable con il conteggio totale dei messaggi non letti.
   * Questo è il metodo da sottoscrivere in `app.component.ts`.
   * @returns Un Observable di tipo number.
   */
  getUnreadCount$(): Observable<number> {
    return this.unreadCount$.asObservable();
  }

  // --- METODI MANTENUTI PER COMPATIBILITÀ CON CHATLISTPAGE ---
  /**
   * Restituisce il conteggio dei messaggi non letti per una specifica chat
   * basandosi sulla mappa interna del servizio.
   * NOTA: Questo conteggio è mantenuto separatamente e non è la fonte principale
   * del conteggio globale aggiornato da Firebase.
   * @param chatId L'ID della chat.
   * @returns Il numero di messaggi non letti per quella chat.
   */
  getUnreadCountForChat(chatId: string): number {
    return this.unreadMessages[chatId] || 0;
  }

  /**
   * Incrementa il conteggio dei messaggi non letti per una specifica chat
   * nella mappa interna del servizio.
   * NOTA: Non aggiorna direttamente il conteggio globale, che è guidato da Firebase.
   * @param chatId L'ID della chat.
   */
  incrementUnread(chatId: string) {
    this.unreadMessages[chatId] = (this.unreadMessages[chatId] || 0) + 1;
    // Non chiamiamo `updateTotalUnread()` qui per evitare conflitti con la logica Firebase.
    // L'aggiornamento globale avviene tramite la pipeline RxJS.
    console.log(`ChatNotificationService: Incrementato unread per ${chatId} a ${this.unreadMessages[chatId]}`);
  }

  /**
   * Azzera il conteggio dei messaggi non letti per una specifica chat
   * nella mappa interna del servizio.
   * NOTA: Non aggiorna direttamente il conteggio globale, che è guidato da Firebase.
   * @param chatId L'ID della chat.
   */
  clearUnread(chatId: string) {
    delete this.unreadMessages[chatId];
    // Non chiamiamo `updateTotalUnread()` qui per evitare conflitti con la logica Firebase.
    // L'aggiornamento globale avviene tramite la pipeline RxJS.
    console.log(`ChatNotificationService: Azzerato unread per ${chatId}`);
  }
  // --- FINE METODI MANTENUTI ---

  // Rimosso: `updateTotalUnread` perché non è più la fonte del conteggio globale.
  // La mappa `unreadMessages` è ora solo per scopi locali/compatibilità.
  // private updateTotalUnread() { ... }

  // Rimosso: `updateTotalUnreadFromConversations` è stato integrato direttamente nella pipeline RxJS.
  // private updateTotalUnreadFromConversations(conversations: ConversationDocument[]) { ... }
}
