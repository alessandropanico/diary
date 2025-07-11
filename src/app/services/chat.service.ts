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

  async sendMessage(conversationId: string, senderId: string, text: string): Promise<void> {
    if (!conversationId || !senderId || !text) {
      console.error('Dati mancanti per inviare il messaggio.');
      throw new Error('Dati messaggio incompleti.');
    }

    const messagesRef = collection(this.firestore, `conversations/${conversationId}/messages`);
    const conversationDocRef = doc(this.firestore, 'conversations', conversationId);

    try {
      await addDoc(messagesRef, {
        senderId: senderId,
        text: text,
        timestamp: serverTimestamp()
      });

      await updateDoc(conversationDocRef, {
        lastMessage: text.substring(0, 50),
        lastMessageAt: serverTimestamp()
      });

    } catch (error) {
      console.error('Errore durante l\'invio del messaggio:', error);
      throw error;
    }
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
  getUserConversations(currentUserId: string): Observable<ExtendedConversation[]> {
    const conversationsRef = collection(this.firestore, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', currentUserId),
      orderBy('lastMessageAt', 'desc')
    );

    return new Observable<any[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const rawConversations: any[] = [];
        snapshot.forEach(doc => {
          rawConversations.push({ id: doc.id, ...doc.data() });
        });
        observer.next(rawConversations);
      }, (error) => {
        console.error('Errore nel recupero delle conversazioni utente in tempo reale:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    }).pipe(
      switchMap(conversations => {
        if (conversations.length === 0) {
          return of([]); // Se non ci sono conversazioni, restituisci un array vuoto
        }

        const conversationObservables = conversations.map(conv => {
          const otherParticipantId = conv.participants.find((pId: string) => pId !== currentUserId);

          if (otherParticipantId) {
            // Recupera i dettagli dell'altro utente dalla collezione 'users'
            const userDocRef = doc(this.firestore, `users/${otherParticipantId}`);
            return new Observable<ExtendedConversation>(userObserver => {
              getDoc(userDocRef).then(userDocSnap => {
                const userData = userDocSnap.data() as UserProfile; // Cast per TypeScript
                userObserver.next({
                  ...conv,
                  otherParticipantId: otherParticipantId,
                  otherParticipantName: userData?.name || 'Utente senza nome', // Fallback
                  otherParticipantPhoto: userData?.photoURL || 'assets/imgs/default-user-photo.png', // Fallback. Cambia il percorso!
                  displayLastMessageAt: this.formatTimestamp(conv.lastMessageAt)
                });
                userObserver.complete(); // Completa l'observable dopo aver ottenuto i dati
              }).catch(error => {
                console.error(`Errore nel recupero utente ${otherParticipantId}:`, error);
                userObserver.next({ // Emetti comunque la conversazione con fallback in caso di errore
                  ...conv,
                  otherParticipantId: otherParticipantId,
                  otherParticipantName: 'Utente senza nome',
                  otherParticipantPhoto: 'assets/imgs/default-user-photo.png',
                  displayLastMessageAt: this.formatTimestamp(conv.lastMessageAt)
                });
                userObserver.complete();
              });
            });
          } else {
            // Caso in cui la conversazione ha solo l'utente corrente (es. chat con se stesso)
            return of({
              ...conv,
              otherParticipantId: currentUserId,
              otherParticipantName: 'Tu (Utente)', // O il nome del tuo utente se lo recuperi
              otherParticipantPhoto: 'assets/imgs/your-profile-photo.png', // Percorso della tua foto profilo
              displayLastMessageAt: this.formatTimestamp(conv.lastMessageAt)
            } as ExtendedConversation);
          }
        });
        // Usa forkJoin per aspettare che tutte le richieste degli utenti siano complete
        return forkJoin(conversationObservables);
      })
    );
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
