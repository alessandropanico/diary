// src/app/services/chat-notification.service.ts

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, Observable, combineLatest } from 'rxjs';
import { getAuth, User as FirebaseUser } from 'firebase/auth'; // Importa User di Firebase Auth
import { ChatService, ConversationDocument } from './chat.service'; // Importa il ChatService e le interfacce necessarie
import { map, switchMap, tap } from 'rxjs/operators';
import { Timestamp } from 'firebase/firestore'; // Importa Timestamp di Firebase

interface UnreadMessagesMap {
  [chatId: string]: number; // Potrebbe essere 0 o 1 se contiamo solo "non letto", o il numero effettivo
}

@Injectable({ providedIn: 'root' })
export class ChatNotificationService implements OnDestroy {
  // unreadMessages non è più usato per il calcolo, ma mantenuto per la compatibilità con increment/clear
  private unreadMessages: UnreadMessagesMap = {};
  private unreadCount$ = new BehaviorSubject<number>(0);

  private authSubscription: Subscription | undefined;
  private conversationsSubscription: Subscription | undefined;
  private currentUserId: string | null = null;

  constructor(private chatService: ChatService) {
    this.init(); // Inizializza il servizio all'avvio
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.conversationsSubscription) {
      this.conversationsSubscription.unsubscribe();
    }
  }

  private init() {
    // 1. Ascolta i cambiamenti dello stato di autenticazione
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
          // Se l'utente si disconnette, resetta il conteggio e disiscriviti
          this.unreadMessages = {};
          this.unreadCount$.next(0);
          if (this.conversationsSubscription) {
            this.conversationsSubscription.unsubscribe();
            this.conversationsSubscription = undefined;
          }
        }
      }),
      // 2. Se l'utente è loggato, passa all'ascolto delle sue conversazioni
      switchMap(user => {
        if (user && user.uid) {
          console.log('ChatNotificationService: Ascolto conversazioni per utente:', user.uid);
          return this.chatService.getUserConversations(user.uid);
        } else {
          return new Observable<ConversationDocument[]>(); // Observable vuoto se non loggato
        }
      })
    ).subscribe({
      next: (conversations: ConversationDocument[]) => {
        // 3. Quando le conversazioni cambiano, ricalcola il totale dei non letti
        console.log('ChatNotificationService: Ricevute conversazioni aggiornate:', conversations.length);
        this.updateTotalUnreadFromConversations(conversations);
      },
      error: (err) => {
        console.error('ChatNotificationService: Errore nel recupero delle conversazioni:', err);
      }
    });
  }

  private updateTotalUnreadFromConversations(conversations: ConversationDocument[]) {
    let totalUnread = 0;
    if (!this.currentUserId) {
      this.unreadCount$.next(0);
      return;
    }

    // Qui ricalcoliamo il conteggio basandoci sui dati di Firebase
    conversations.forEach(conv => {
      const lastMessageAt = conv.lastMessageAt; // Timestamp dell'ultimo messaggio
      const lastReadByMe = conv.lastRead?.[this.currentUserId!]; // Ultima lettura dell'utente corrente

      // Condizione per "non letto": c'è un ultimo messaggio E
      // (non l'ho mai letto OPPURE l'ultimo messaggio è più recente della mia ultima lettura)
      if (lastMessageAt && (!lastReadByMe || lastReadByMe.toMillis() < lastMessageAt.toMillis())) {
        totalUnread++;
      }
    });

    // Aggiorna il BehaviorSubject con il nuovo conteggio totale
    this.unreadCount$.next(totalUnread);
    console.log('ChatNotificationService: Totale messaggi non letti aggiornato:', totalUnread);
  }


  // Questo metodo è ancora utile per il CHAT LIST PAGE per sapere se UNA SINGOLA CHAT ha notifiche
  // MA non è più la fonte principale del conteggio globale
  getUnreadCountForChat(chatId: string): number {
      // Per il conteggio di una singola chat, potresti volerlo recuperare dallo stato più recente
      // Dobbiamo estendere qui la logica se vogliamo un conteggio *esatto* per chat.
      // Per ora, visto che ChatListPage calcola `unreadMessageCount`, potremmo usarlo.
      // Tuttavia, il servizio in sé non ha uno stato dettagliato per chat, solo il totale.
      // Per ora, manteniamo la vecchia logica di `unreadMessages` o la rimuoviamo se vogliamo affidarci solo a Firebase.
      // Per coerenza con l'aggiornamento, questo metodo non è più la fonte primaria di verità per il conteggio *esatto* per chat.
      // Potresti volerla rimuovere e far sì che ChatListPage calcoli il suo conteggio.
      // Per il momento, la lascio ma sappi che non è agganciata a Firebase da qui.
      return this.unreadMessages[chatId] || 0;
  }

  // Questi metodi incrementUnread/clearUnread sono ora meno rilevanti per il conteggio *globale*
  // perché il conteggio globale viene ricalcolato dal flusso di dati di Firebase.
  // Tuttavia, la ChatListPage li usa ancora per aggiornare la mappa *interna* di ChatNotificationService,
  // che poi triggera un updateTotalUnread. Se vogliamo affidarci solo a Firebase, questi possono essere rimossi
  // e la ChatListPage non li chiamerà più.
  // Per mantenere la compatibilità per ora:
  incrementUnread(chatId: string) {
    // Questo è un fallback o per aggiornamenti immediati non da Firebase
    this.unreadMessages[chatId] = (this.unreadMessages[chatId] || 0) + 1;
    this.updateTotalUnread(); // Ricalcola il totale dalla mappa interna
  }

  clearUnread(chatId: string) {
    // Questo è un fallback o per aggiornamenti immediati non da Firebase
    delete this.unreadMessages[chatId];
    this.updateTotalUnread(); // Ricalcola il totale dalla mappa interna
  }

  // Questo metodo è ancora usato da incrementUnread/clearUnread per aggiornare il BehaviorSubject
  // basandosi sulla mappa interna `unreadMessages`.
  // Nel nuovo approccio basato su Firebase, `updateTotalUnreadFromConversations` è il principale.
  private updateTotalUnread() {
    const total = Object.values(this.unreadMessages).reduce((a, b) => a + b, 0);
    this.unreadCount$.next(total);
  }

  // Questo è il metodo pubblico per ottenere il conteggio totale delle notifiche (per app.component)
  getUnreadCount$(): Observable<number> {
    return this.unreadCount$.asObservable();
  }
}
