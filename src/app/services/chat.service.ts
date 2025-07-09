import { Injectable } from '@angular/core';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { Observable } from 'rxjs';

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

  getMessages(conversationId: string, limitMessages: number = 50): Observable<any[]> {
    const messagesRef = collection(this.firestore, `conversations/${conversationId}/messages`);
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc'),
      limit(limitMessages)
    );

    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages: any[] = [];
        snapshot.forEach(doc => {
          messages.push({ id: doc.id, ...doc.data(), timestamp: doc.data()['timestamp']?.toDate() || new Date() });
        });
        observer.next(messages);
      }, (error) => {
        console.error('Errore nel recupero dei messaggi in tempo reale:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
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

  getUserConversations(userId: string): Observable<any[]> {
    const conversationsRef = collection(this.firestore, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageAt', 'desc')
    );

    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const conversations: any[] = [];
        snapshot.forEach(doc => {
          conversations.push({ id: doc.id, ...doc.data() });
        });
        observer.next(conversations);
      }, (error) => {
        console.error('Errore nel recupero delle conversazioni utente in tempo reale:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }
}
