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
  Timestamp,
  arrayUnion,
  arrayRemove
} from '@angular/fire/firestore';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as dayjs from 'dayjs';

// --- Interfacce DEFINITIVE per questo esercizio ---

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
}

export interface PagedMessages {
  messages: Message[];
  lastVisibleDoc: QueryDocumentSnapshot | null;
  firstVisibleDoc: QueryDocumentSnapshot | null; // ⭐⭐ AGGIUNTA QUESTA LINEA ⭐⭐
  hasMore: boolean;
}

export interface UserProfile {
  uid?: string;
  name?: string;
  nickname?: string;
  photo?: string;
  photoURL?: string;
  bio?: string;
  email?: string;
  lastOnline?: string;
}

export interface ConversationDocument {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  createdAt?: Timestamp;
  lastMessageSenderId?: string;
  lastRead?: { [userId: string]: Timestamp };
  deletedBy?: string[];
}

export interface ExtendedConversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  createdAt: Timestamp | null;
  chatId: string;
  otherParticipantId: string;
  otherParticipantName: string;
  otherParticipantPhoto: string;
  displayLastMessageAt: string;
  lastMessageSenderId?: string;
  lastRead?: { [userId: string]: Timestamp };
  hasUnreadMessages?: boolean;
  unreadMessageCount?: number;
  deletedBy?: string[];
  otherParticipantIsOnline?: boolean;
  otherParticipantLastOnline?: string;
}

// --- Fine Interfacce ---

import { UserDataService } from './user-data.service';
import { getAuth } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  constructor(
    public afs: Firestore,
    private userDataService: UserDataService,
    private ngZone: NgZone
  ) { }

  async getOrCreateConversation(user1Id: string, user2Id: string): Promise<string> {
    const conversationsRef = collection(this.afs, 'conversations');
    const sortedParticipants = [user1Id, user2Id].sort();

    const q = query(
      conversationsRef,
      where('participants', '==', sortedParticipants)
    );

    try {
      const querySnapshot = await getDocs(q);
      let existingConversationDoc: QueryDocumentSnapshot | null = null;

      // Cerca una conversazione esistente tra i due utenti
      if (!querySnapshot.empty) {
        // In un sistema 1-a-1 ci aspettiamo al massimo 1 documento
        existingConversationDoc = querySnapshot.docs[0];
      }

      if (existingConversationDoc) {
        const conversationId = existingConversationDoc.id;
        const convData = existingConversationDoc.data() as ConversationDocument;

        console.log('Conversazione esistente trovata:', conversationId);

        // Se la conversazione era stata "eliminata" da uno o entrambi, la "ripristiniamo"
        if (convData.deletedBy && convData.deletedBy.length > 0) {
          console.log(`Ripristino conversazione ${conversationId} (rimozione deletedBy).`);
          await updateDoc(doc(this.afs, 'conversations', conversationId), {
            deletedBy: [] // Rimuove tutti gli ID dal campo deletedBy
          });
        }
        return conversationId;
      } else {
        console.log('Nessuna conversazione esistente per gli utenti, creando una nuova.');
        const newConversationRef = doc(conversationsRef);

        const newConversationData: ConversationDocument = {
          id: newConversationRef.id,
          participants: sortedParticipants,
          createdAt: serverTimestamp() as Timestamp,
          lastMessage: '',
          lastRead: {
            [user1Id]: serverTimestamp() as Timestamp,
            [user2Id]: serverTimestamp() as Timestamp
          },
          deletedBy: [] // Una nuova conversazione non è "deleted"
        };
        await setDoc(newConversationRef, newConversationData);
        return newConversationRef.id;
      }
    } catch (error) {
      console.error('Errore durante la ricerca o creazione della conversazione:', error);
      throw error;
    }
  }


  async sendMessage(conversationId: string, senderId: string, text: string): Promise<void> {
    const messagesCollectionRef = collection(this.afs, `conversations/${conversationId}/messages`);
    const conversationDocRef = doc(this.afs, 'conversations', conversationId);

    try {
      await addDoc(messagesCollectionRef, {
        senderId: senderId,
        text: text,
        timestamp: serverTimestamp()
      });

      const conversationSnap = await getDoc(conversationDocRef);
      if (!conversationSnap.exists()) {
        console.error('Errore: Conversazione non trovata per l\'invio del messaggio.');
        throw new Error('Conversazione non trovata.');
      }
      const conversationData = conversationSnap.data() as ConversationDocument;

      // NON ABBIAMO PIÙ BISOGNO DI QUESTO BLOCCO QUI
      // L' "undelete" viene gestito in getOrCreateConversation
      /*
      const undeletePromises: Promise<void>[] = [];
      conversationData.participants.forEach(participantId => {
        undeletePromises.push(updateDoc(conversationDocRef, {
          deletedBy: arrayRemove(participantId)
        }));
      });
      await Promise.all(undeletePromises);
      */

      // Assicurati che il campo deletedBy sia vuoto quando si invia un messaggio,
      // per ridondanza e per catturare casi limite in cui getOrCreateConversation
      // non sia stato chiamato immediatamente prima.
      if (conversationData.deletedBy && conversationData.deletedBy.length > 0) {
        await updateDoc(conversationDocRef, {
          deletedBy: [] // Svuota il campo deletedBy
        });
      }


      await updateDoc(conversationDocRef, {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: senderId,
        [`lastRead.${senderId}`]: serverTimestamp()
      });

    } catch (error) {
      console.error('Errore durante l\'invio del messaggio:', error);
      throw error;
    }
  }

  getMessages(conversationId: string, limitMessages: number = 20): Observable<PagedMessages> {
    const messagesRef = collection(this.afs, `conversations/${conversationId}/messages`);
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
            timestamp: (doc.data()['timestamp'] as Timestamp)?.toDate() || new Date()
          } as Message);
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

        this.ngZone.run(() => {
          observer.next({ messages, lastVisibleDoc, firstVisibleDoc, hasMore }); // ⭐ Correzione QUI ⭐
        });
      }, (error) => {
        this.ngZone.run(() => {
          console.error('Errore nel recupero dei messaggi in tempo reale:', error);
          observer.error(error);
        });
      });

      return () => unsubscribe();
    });
  }

  async getOlderMessages(conversationId: string, limitMessages: number = 20, startAfterDoc: QueryDocumentSnapshot): Promise<PagedMessages> {
    const messagesRef = collection(this.afs, `conversations/${conversationId}/messages`);
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

      // ⭐ Correzione QUI: Assegna null a firstVisibleDoc se non è rilevante per questo metodo ⭐
      return { messages, lastVisibleDoc, firstVisibleDoc: null, hasMore };
    } catch (error) {
      console.error('Errore nel recupero dei messaggi più vecchi:', error);
      throw error;
    }
  }

  public getConversationDetails(conversationId: string): Observable<ExtendedConversation | null> {
    const conversationRef = doc(this.afs, 'conversations', conversationId);
    const auth = getAuth();

    return new Observable(observer => {
      const unsubscribe = onSnapshot(conversationRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ConversationDocument;

          const currentUserId = auth.currentUser?.uid;
          const participants = data.participants;
          const otherParticipantId = participants.find((id: string) => id !== currentUserId);

          let otherParticipantData: UserProfile | null = null;
          if (otherParticipantId) {
            otherParticipantData = await this.userDataService.getUserDataById(otherParticipantId);
          }

          this.ngZone.run(() => {
            observer.next({
              id: docSnap.id,
              participants: participants,
              lastMessage: data.lastMessage || '',
              lastMessageAt: data.lastMessageAt || null,
              createdAt: data.createdAt || null,
              chatId: docSnap.id,
              otherParticipantId: otherParticipantId || '',
              otherParticipantName: otherParticipantData?.nickname || otherParticipantData?.name || 'Utente Sconosciuto',
              otherParticipantPhoto: otherParticipantData?.photo || 'assets/immaginiGenerali/default-avatar.jpg',
              displayLastMessageAt: '',
              lastMessageSenderId: data.lastMessageSenderId || '',
              lastRead: data.lastRead || {},
              deletedBy: data.deletedBy || [],
              otherParticipantIsOnline: false,
              otherParticipantLastOnline: otherParticipantData?.lastOnline
            } as ExtendedConversation);
          });
        } else {
          this.ngZone.run(() => {
            observer.next(null);
          });
        }
      }, (error: any) => {
        this.ngZone.run(() => {
          console.error('Errore in getConversationDetails onSnapshot:', error);
          observer.error(error);
        });
      });
      return () => unsubscribe();
    });
  }

  getUserConversations(userId: string): Observable<ConversationDocument[]> {
    const conversationsRef = collection(this.afs, 'conversations');
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
            lastRead: data['lastRead'] as { [userId: string]: Timestamp } || {},
            deletedBy: data['deletedBy'] as string[] || []
          };
        });
        this.ngZone.run(() => {
          observer.next(convs);
        });
      }, (error) => {
        this.ngZone.run(() => {
          console.error('Errore in getUserConversations onSnapshot:', error);
          observer.error(error);
        });
      });
      return { unsubscribe };
    });
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    const conversationRef = doc(this.afs, 'conversations', conversationId);
    try {
      await updateDoc(conversationRef, {
        [`lastRead.${userId}`]: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Errore nel marcare i messaggi come letti:', error);
      throw error;
    }
  }

  private formatTimestamp(timestamp: any): string {
    if (!timestamp) {
      return '';
    }
    const date = timestamp.toDate();
    return dayjs(date).format('DD/MM/YYYY HH:mm');
  }

  async countUnreadMessages(conversationId: string, userId: string, lastRead: Timestamp | null): Promise<number> {
    const messagesRef = collection(this.afs, `conversations/${conversationId}/messages`);

    let q;
    if (lastRead) {
      q = query(messagesRef, where('timestamp', '>', lastRead));
    } else {
      q = query(messagesRef);
    }

    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  async markConversationAsDeleted(conversationId: string, userId: string): Promise<void> {
    const conversationRef = doc(this.afs, 'conversations', conversationId);
    try {
      await updateDoc(conversationRef, {
        deletedBy: arrayUnion(userId)
      });
      console.log(`Conversazione ${conversationId} marcata come eliminata per l'utente ${userId}.`);
    } catch (error) {
      console.error(`Errore nel marcare la conversazione ${conversationId} come eliminata:`, error);
      throw error;
    }
  }
}
