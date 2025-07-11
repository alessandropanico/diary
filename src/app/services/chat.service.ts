// chat.service.ts
import { Injectable } from '@angular/core';
import {
  getFirestore,
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
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { Observable, forkJoin, of } from 'rxjs'; // Importa forkJoin e of
import { map, switchMap } from 'rxjs/operators'; // Importa gli operatori RxJS
import * as dayjs from 'dayjs'; // Assicurati di aver installato dayjs: npm install dayjs
import { Message, PagedMessages } from '../interfaces/chat';

// Interfaccia per i dettagli utente (se hai una collezione 'users')
interface UserProfile {
  name: string;
  photoURL: string; // O il nome del tuo campo per l'URL della foto
  // Aggiungi altri campi del tuo profilo utente se necessari
}

// Interfaccia per la conversazione estesa (con i dettagli dell'altro partecipante)
export interface ExtendedConversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: any; // Firebase Timestamp
  createdAt: any; // Firebase Timestamp
  chatId: string;
  otherParticipantId: string;
  otherParticipantName: string;
  otherParticipantPhoto: string;
  displayLastMessageAt: string;
}


@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private firestore = getFirestore();

  constructor() { }

  private generateConversationId(user1Id: string, user2Id: string): string {
    const sortedIds = [user1Id, user2Id].sort();
    return sortedIds.join('_');
  }

  async getOrCreateConversation(user1Id: string, user2Id: string): Promise<string> {
    const chatId = this.generateConversationId(user1Id, user2Id);
    const conversationDocRef = doc(this.firestore, 'conversations', chatId);

    try {
      const docSnap = await getDoc(conversationDocRef);

      if (docSnap.exists()) {
        return docSnap.id;
      } else {
        const newConversationData = {
          participants: [user1Id, user2Id].sort(),
          createdAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          lastMessage: '',
          chatId: chatId
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
    const messagesCollectionRef = collection(this.firestore, `conversations/${conversationId}/messages`);
    const conversationDocRef = doc(this.firestore, 'conversations', conversationId);

    await addDoc(messagesCollectionRef, {
      senderId: senderId,
      text: text,
      timestamp: serverTimestamp()
    });

    // *** ASSICURATI CHE QUESTA RIGA SIA PRESENTE E CORRETTA ***
    await updateDoc(conversationDocRef, {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId // <-- DEVE ESSERE QUI!
    });
  }

  getMessages(conversationId: string, limitMessages: number = 20): Observable<PagedMessages> {
    const messagesRef = collection(this.firestore, `conversations/${conversationId}/messages`);
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
          messages.push({ id: doc.id, ...doc.data(), timestamp: doc.data()['timestamp']?.toDate() || new Date() } as Message);
        });

        if (snapshot.docs.length > 0) {
          firstVisibleDoc = snapshot.docs[0];
          lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        }

        let hasMore = false;
        if (lastVisibleDoc) {
            const olderQuery = query(
                messagesRef,
                orderBy('timestamp', 'desc'),
                startAfter(lastVisibleDoc),
                limit(1)
            );
            const olderSnapshot = await getDocs(olderQuery);
            hasMore = olderSnapshot.docs.length > 0;
        }

        observer.next({ messages, lastVisibleDoc, firstVisibleDoc, hasMore });
      }, (error) => {
        console.error('Errore nel recupero dei messaggi in tempo reale:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  async getOlderMessages(conversationId: string, limitMessages: number = 20, startAfterDoc: QueryDocumentSnapshot): Promise<PagedMessages> {
    const messagesRef = collection(this.firestore, `conversations/${conversationId}/messages`);
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
        messages.push({ id: doc.id, ...doc.data(), timestamp: doc.data()['timestamp']?.toDate() || new Date() } as Message);
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
   * Ottiene i dettagli di una singola conversazione (util per mostrare nella lista chat)
   * @param conversationId ID della conversazione.
   * @returns I dettagli della conversazione.
   */
  async getConversationDetails(conversationId: string): Promise<any | null> {
    const docRef = doc(this.firestore, 'conversations', conversationId);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Errore nel recupero dettagli conversazione:', error);
      return null;
    }
  }

  // --- METODO MODIFICATO QUI ---
 getUserConversations(userId: string): Observable<any[]> { // Specifico il tipo di ritorno come Observable<any[]>
    const conversationsRef = collection(this.firestore, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageAt', 'desc')
    );

    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const convs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Assicurati che lastMessageAt sia gestito correttamente se è un Timestamp di Firebase
            lastMessageAt: data['lastMessageAt'] ? data['lastMessageAt'] : null,
            // Assicurati che lastMessageSenderId sia incluso qui quando mappi i dati
            lastMessageSenderId: data['lastMessageSenderId'] ? data['lastMessageSenderId'] : null
          };
        });
        observer.next(convs);
      }, (error) => {
        observer.error(error);
      });
      return { unsubscribe }; // Restituisce la funzione di unsubscribe
    });
  }


  private formatTimestamp(timestamp: any): string {
    if (!timestamp) {
      return '';
    }
    // Firebase Timestamp object has a toDate() method
    const date = timestamp.toDate();
    // Usa dayjs per formattare (assicurati sia installato: npm install dayjs)
    return dayjs(date).format('DD/MM/YYYY HH:mm');
  }
}
