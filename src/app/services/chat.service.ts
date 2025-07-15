// src/app/services/chat.service.ts
import { Injectable, NgZone } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  startAfter,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  orderBy,
  limit,
  onSnapshot,
  QueryDocumentSnapshot,
  Timestamp // Importa Timestamp per i tipi di Firebase
} from '@angular/fire/firestore'; // Importa Firestore da @angular/fire/firestore

import { Observable } from 'rxjs'; // Manteniamo solo Observable
import { map, switchMap } from 'rxjs/operators';
import * as dayjs from 'dayjs'; // Assicurati di aver installato dayjs: npm install dayjs

// Questo è un placeholder. Se hai un file interfaces/chat.ts,
// le interfacce Message e PagedMessages dovrebbero venire da lì.
export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date; // Usiamo Date perché 'toDate()' lo converte
}

export interface PagedMessages {
  messages: Message[];
  lastVisibleDoc: QueryDocumentSnapshot | null;
  firstVisibleDoc: QueryDocumentSnapshot | null; // Aggiunto per consistenza, anche se non sempre usato
  hasMore: boolean;
}

// --- Interfacce DEFINITIVE per questo esercizio (puoi spostarle in interfaces/chat.ts) ---

// Interfaccia per i dettagli utente (se hai una collezione 'users')
// Questi campi devono corrispondere a ciò che UserDataService.getUserDataById restituisce
export interface UserProfile {
  uid?: string;
  name?: string;
  nickname?: string;
  photo?: string;
  photoURL?: string;
  bio?: string;
  email?: string;
}

// Interfaccia per il documento della conversazione letto direttamente da Firestore
// (rappresenta il documento grezzo della collezione 'conversations' con l'ID)
export interface ConversationDocument {
  id: string; // L'ID del documento, mappato manualmente da doc.id
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Timestamp; // Firebase Timestamp
  createdAt?: Timestamp; // Firebase Timestamp
  lastMessageSenderId?: string;
  lastRead?: { [userId: string]: Timestamp }; // Mappa userId -> Timestamp
  chatId?: string; // Il tuo documento Firestore ha anche un chatId a volte
}

// Interfaccia per la conversazione estesa (con i dettagli dell'altro partecipante e info UI)
// Questa è la versione "arricchita" usata in ChatListPage
export interface ExtendedConversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: Timestamp | null; // Firebase Timestamp
  createdAt: Timestamp | null; // Firebase Timestamp
  chatId: string;
  otherParticipantId: string;
  otherParticipantName: string;
  otherParticipantPhoto: string;
  displayLastMessageAt: string; // Versione formattata della data
  lastMessageSenderId?: string;
  lastRead?: { [userId: string]: Timestamp };
  hasUnreadMessages?: boolean;
  unreadCount?: number;
  unreadMessageCount?: number; // Aggiungi questa proprietà

}

// --- Fine Interfacce ---

import { UserDataService } from './user-data.service';
// Rimuovi l'importazione di ChatNotificationService. Non è più necessario qui.
// import { ChatNotificationService } from './chat-notification.service';
import { getAuth } from 'firebase/auth'; // Per accedere all'utente loggato

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  constructor(
    public afs: Firestore, // L'istanza di Firestore da @angular/fire
    private userDataService: UserDataService,
    private ngZone: NgZone // Usato per assicurarsi che agli aggiornamenti UI avvengano nella zona di Angular
    // Rimuovi completamente l'iniezione di ChatNotificationService dal costruttore
    // private chatNotificationService: ChatNotificationService // Servizio per il conteggio notifiche
  ) { }

  private generateConversationId(user1Id: string, user2Id: string): string {
    const sortedIds = [user1Id, user2Id].sort();
    return sortedIds.join('_');
  }

  async getOrCreateConversation(user1Id: string, user2Id: string): Promise<string> {
    const chatId = this.generateConversationId(user1Id, user2Id);
    const conversationDocRef = doc(this.afs, 'conversations', chatId);

    try {
      const docSnap = await getDoc(conversationDocRef);

      if (docSnap.exists()) {
        return docSnap.id;
      } else {
        const newConversationData: any = { // Usa `any` temporaneamente per la flessibilità o definisci meglio l'interfaccia
          participants: [user1Id, user2Id].sort(),
          createdAt: serverTimestamp(),
          // ✅ Rimosso lastMessageAt e lastMessageSenderId da qui
          lastMessage: '', // Messaggio iniziale vuoto
          chatId: chatId,
          lastRead: {
            [user1Id]: serverTimestamp(), // Marca come letto al momento della creazione
            [user2Id]: serverTimestamp()
          }
        };
        await setDoc(conversationDocRef, newConversationData);
        return chatId;
      }
    } catch (error) {
      console.error('Errore durante la ricerca o creazione della conversazione:', error);
      throw error;
    }
  }

  /**
   * Invia un messaggio e aggiorna i dati della conversazione.
   * @param conversationId L'ID della conversazione.
   * @param senderId L'ID dell'utente che invia il messaggio.
   * @param text Il testo del messaggio.
   */
  async sendMessage(conversationId: string, senderId: string, text: string): Promise<void> {
    const messagesCollectionRef = collection(this.afs, `conversations/${conversationId}/messages`); // Usa this.afs
    const conversationDocRef = doc(this.afs, 'conversations', conversationId); // Usa this.afs

    await addDoc(messagesCollectionRef, {
      senderId: senderId,
      text: text,
      timestamp: serverTimestamp()
    });

    // Aggiorna la conversazione con l'ultimo messaggio, il suo timestamp, e il mittente
    // Marca anche il messaggio come letto per il mittente in `lastRead`
    await updateDoc(conversationDocRef, {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId, // <-- Assicurati che questo campo venga sempre aggiornato
      [`lastRead.${senderId}`]: serverTimestamp() // Marca il messaggio come letto per il mittente
    });
    // Rimuovi qualsiasi chiamata a this.chatNotificationService.incrementUnread() qui.
    // Il ChatNotificationService si aggiornerà da solo ascoltando i dati di Firebase.
  }

  getMessages(conversationId: string, limitMessages: number = 20): Observable<PagedMessages> {
    const messagesRef = collection(this.afs, `conversations/${conversationId}/messages`); // Usa this.afs
    const q = query(
      messagesRef,
      orderBy('timestamp', 'desc'),
      limit(limitMessages)
    );

    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const messages: Message[] = [];
        let lastVisibleDoc: QueryDocumentSnapshot | null = null;
        let firstVisibleDoc: QueryDocumentSnapshot | null = null;

        snapshot.forEach(doc => {
          messages.push({
            id: doc.id,
            ...doc.data(),
            // Converte Timestamp di Firebase in oggetto Date di JavaScript
            timestamp: (doc.data()['timestamp'] as Timestamp)?.toDate() || new Date()
          } as Message);
        });

        // I messaggi sono ordinati in modo decrescente (dal più recente al più vecchio)
        if (snapshot.docs.length > 0) {
          firstVisibleDoc = snapshot.docs[0]; // Il più recente
          lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1]; // Il più vecchio
        }

        let hasMore = false;
        if (lastVisibleDoc) {
          // Controlla se ci sono messaggi ancora più vecchi
          const olderQuery = query(
            messagesRef,
            orderBy('timestamp', 'desc'),
            startAfter(lastVisibleDoc),
            limit(1) // Basta controllare se esiste almeno un altro documento
          );
          const olderSnapshot = await getDocs(olderQuery);
          hasMore = olderSnapshot.docs.length > 0;
        }

        this.ngZone.run(() => { // Assicurati che gli aggiornamenti avvengano nella zona di Angular
          observer.next({ messages, lastVisibleDoc, firstVisibleDoc, hasMore });
        });
      }, (error) => {
        this.ngZone.run(() => { // Gestisci gli errori nella zona di Angular
          console.error('Errore nel recupero dei messaggi in tempo reale:', error);
          observer.error(error);
        });
      });

      return () => unsubscribe();
    });
  }

  async getOlderMessages(conversationId: string, limitMessages: number = 20, startAfterDoc: QueryDocumentSnapshot): Promise<PagedMessages> {
    const messagesRef = collection(this.afs, `conversations/${conversationId}/messages`); // Usa this.afs
    const q = query(
      messagesRef,
      orderBy('timestamp', 'desc'),
      startAfter(startAfterDoc),
      limit(limitMessages)
    );

    try {
      const snapshot = await getDocs(q);
      const messages: Message[] = [];
      snapshot.forEach(doc => {
        messages.push({
          id: doc.id,
          ...doc.data(),
          timestamp: (doc.data()['timestamp'] as Timestamp)?.toDate() || new Date()
        } as Message);
      });

      let lastVisibleDoc: QueryDocumentSnapshot | null = null;
      if (snapshot.docs.length > 0) {
        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
      }

      let hasMore = false;
      if (lastVisibleDoc) {
        const nextQuery = query(
          messagesRef,
          orderBy('timestamp', 'desc'),
          startAfter(lastVisibleDoc),
          limit(1)
        );
        const nextSnapshot = await getDocs(nextQuery);
        hasMore = nextSnapshot.docs.length > 0;
      }

      return { messages, lastVisibleDoc, firstVisibleDoc: null, hasMore };
    } catch (error) {
      console.error('Errore nel recupero dei messaggi più vecchi:', error);
      throw error;
    }
  }

  /**
   * Ottiene i dettagli di una singola conversazione in tempo reale.
   * Questo metodo è cruciale per la ChatListPage per ottenere dettagli aggiornati,
   * inclusi i dati dell'altro partecipante e gli indicatori di ultima lettura.
   * @param conversationId L'ID della conversazione.
   * @returns Un Observable che emette i dettagli della conversazione.
   */
  public getConversationDetails(conversationId: string): Observable<ExtendedConversation | null> {
    const conversationRef = doc(this.afs, 'conversations', conversationId); // Usa this.afs
    const auth = getAuth(); // Ottieni l'istanza di autenticazione

    return new Observable(observer => {
      const unsubscribe = onSnapshot(conversationRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ConversationDocument; // Cast a ConversationDocument per tipizzazione

          const currentUserId = auth.currentUser?.uid;
          const participants = data.participants;
          const otherParticipantId = participants.find((id: string) => id !== currentUserId);

          let otherParticipantData: UserProfile | null = null;
          if (otherParticipantId) {
            // Usa il tuo UserDataService per ottenere i dettagli dell'altro utente
            otherParticipantData = await this.userDataService.getUserDataById(otherParticipantId);
          }

          this.ngZone.run(() => { // Assicurati che l'aggiornamento UI avvenga nella zona di Angular
            observer.next({
              id: docSnap.id,
              participants: participants,
              lastMessage: data.lastMessage || '',
              lastMessageAt: data.lastMessageAt || null, // È un Timestamp di Firebase
              createdAt: data.createdAt || null, // È un Timestamp di Firebase
              chatId: docSnap.id, // chatId è l'id del documento
              otherParticipantId: otherParticipantId || '',
              otherParticipantName: otherParticipantData?.nickname || otherParticipantData?.name || 'Utente Sconosciuto',
              otherParticipantPhoto: otherParticipantData?.photo || 'assets/immaginiGenerali/default-avatar.jpg',
              displayLastMessageAt: '', // Questo sarà calcolato nella ChatListPage usando la data effettiva
              lastMessageSenderId: data.lastMessageSenderId || '', // Assicurati che questo campo esista
              lastRead: data.lastRead || {} // Contiene la mappa di ultima lettura
            } as ExtendedConversation); // Cast per assicurare la tipizzazione corretta
          });
        } else {
          this.ngZone.run(() => {
            observer.next(null); // La conversazione non esiste
          });
        }
      }, (error: any) => {
        this.ngZone.run(() => {
          console.error('Errore in getConversationDetails onSnapshot:', error);
          observer.error(error);
        });
      });
      return () => unsubscribe(); // Restituisce la funzione di unsubscribe
    });
  }

  /**
   * Ottiene le conversazioni di un utente in tempo reale, mappandole a ConversationDocument.
   * Questo è un flusso di dati grezzi che verrà arricchito dalla ChatListPage.
   * @param userId L'ID dell'utente.
   * @returns Un Observable che emette un array di ConversationDocument.
   */
  getUserConversations(userId: string): Observable<ConversationDocument[]> {
    const conversationsRef = collection(this.afs, 'conversations'); // Usa this.afs
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageAt', 'desc')
    );

    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const convs: ConversationDocument[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            participants: data['participants'] as string[],
            lastMessage: data['lastMessage'] as string || '',
            lastMessageAt: data['lastMessageAt'] as Timestamp || null,
            createdAt: data['createdAt'] as Timestamp || null,
            lastMessageSenderId: data['lastMessageSenderId'] as string || '',
            lastRead: data['lastRead'] as { [userId: string]: Timestamp } || {}
          };
        });
        this.ngZone.run(() => { // Esegui nella zona di Angular
          observer.next(convs);
        });
      }, (error) => {
        this.ngZone.run(() => { // Esegui nella zona di Angular
          console.error('Errore in getUserConversations onSnapshot:', error);
          observer.error(error);
        });
      });
      return { unsubscribe }; // Restituisce la funzione di unsubscribe
    });
  }


  /**
   * Marca i messaggi di una conversazione come letti per un utente specifico.
   * Aggiorna il timestamp 'lastRead' per l'utente nella conversazione.
   * @param conversationId L'ID della conversazione.
   * @param userId L'ID dell'utente che ha letto i messaggi.
   */
  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    const conversationRef = doc(this.afs, 'conversations', conversationId); // Usa this.afs
    try {
      // Imposta il timestamp di ultima lettura dell'utente sulla data e ora attuali
      await updateDoc(conversationRef, {
        [`lastRead.${userId}`]: serverTimestamp() // Usa serverTimestamp() per coerenza e precisione
      });
      console.log(`Conversazione ${conversationId} marcata come letta per l'utente ${userId}.`);

      // Rimuovi questa riga! Il ChatNotificationService ora si aggiorna da solo
      // ascoltando i cambiamenti in Firebase.
      // this.chatNotificationService.clearUnread(conversationId);
    } catch (error: any) {
      console.error('Errore nel marcare i messaggi come letti:', error);
      throw error;
    }
  }

  // Questo metodo helper è stato spostato qui dal `chat-list.page.ts` per essere un helper
  // e non è strettamente correlato alla logica di Firebase Firestore.
  // La ChatListPage deciderà come visualizzare la data.
  // Se non lo usi altrove, puoi considerarlo superfluo qui e lasciarlo nella ChatListPage.
  private formatTimestamp(timestamp: any): string {
    if (!timestamp) {
      return '';
    }
    const date = timestamp.toDate();
    return dayjs(date).format('DD/MM/YYYY HH:mm');
  }


  /**
 * Conta quanti messaggi non sono stati letti da uno specifico utente.
 * @param conversationId ID della conversazione
 * @param userId ID dell'utente attuale
 * @param lastRead Timestamp dell'ultimo messaggio letto
 */
  async countUnreadMessages(conversationId: string, userId: string, lastRead: Timestamp | null): Promise<number> {
    const messagesRef = collection(this.afs, `conversations/${conversationId}/messages`);

    let q;
    if (lastRead) {
      q = query(messagesRef, where('timestamp', '>', lastRead));
    } else {
      // Se non ha mai letto nulla, contali tutti
      q = query(messagesRef);
    }

    const snapshot = await getDocs(q);
    return snapshot.size;
  }

}
