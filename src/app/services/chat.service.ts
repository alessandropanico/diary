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
  arrayRemove // Manteniamo arrayRemove per la logica di undelete in sendMessage
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
  firstVisibleDoc: QueryDocumentSnapshot | null;
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
}

// Interfaccia per il documento della conversazione letto direttamente da Firestore
export interface ConversationDocument {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  createdAt?: Timestamp;
  lastMessageSenderId?: string;
  lastRead?: { [userId: string]: Timestamp };
  deletedBy?: string[]; // Campo opzionale per gli ID degli utenti che hanno "eliminato" la chat
}

// Interfaccia per la conversazione estesa (con i dettagli dell'altro partecipante e info UI)
export interface ExtendedConversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  createdAt: Timestamp | null;
  chatId: string; // Sarà l'id del documento
  otherParticipantId: string;
  otherParticipantName: string;
  otherParticipantPhoto: string;
  displayLastMessageAt: string;
  lastMessageSenderId?: string;
  lastRead?: { [userId: string]: Timestamp };
  hasUnreadMessages?: boolean;
  unreadMessageCount?: number;
  deletedBy?: string[];
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

  /**
   * Cerca una conversazione esistente tra due utenti che non sia stata marcata come eliminata
   * dall'utente corrente. Se non ne trova, ne crea una nuova con un ID generato da Firestore.
   * Questo permette di "eliminare" una chat senza che la cronologia riappaia se si avvia una nuova conversazione.
   * @param user1Id L'ID dell'utente corrente.
   * @param user2Id L'ID dell'altro utente.
   * @returns L'ID della conversazione (esistente o nuova).
   */
  async getOrCreateConversation(user1Id: string, user2Id: string): Promise<string> {
    const conversationsRef = collection(this.afs, 'conversations');
    const sortedParticipants = [user1Id, user2Id].sort();

    // ✅ CORREZIONE QUI: Usa 'where("participants", "==", sortedParticipants)'
    // Questo è il modo corretto per trovare una conversazione tra due utenti specifici
    const q = query(
      conversationsRef,
      where('participants', '==', sortedParticipants)
    );

    try {
      const querySnapshot = await getDocs(q);
      let foundConversationId: string | null = null;

      for (const docSnap of querySnapshot.docs) {
        const convData = docSnap.data() as ConversationDocument;
        // Se la conversazione ESISTE e NON è stata eliminata dall'utente corrente, usala.
        // Se è stata eliminata, la ignoriamo e ne creiamo una nuova alla fine.
        if (!(convData.deletedBy && convData.deletedBy.includes(user1Id))) {
          foundConversationId = docSnap.id;
          break;
        }
      }

      if (foundConversationId) {
        console.log('Conversazione esistente valida trovata:', foundConversationId);
        return foundConversationId;
      } else {
        console.log('Nessuna conversazione valida trovata per gli utenti, creando una nuova.');
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
          deletedBy: [] // Le nuove conversazioni non sono eliminate da nessuno
        };
        await setDoc(newConversationRef, newConversationData);
        return newConversationRef.id;
      }
    } catch (error) {
      console.error('Errore durante la ricerca o creazione della conversazione:', error);
      throw error;
    }
  }

  /**
   * Invia un messaggio a una conversazione esistente.
   * ✅ MODIFICATO: Rimuove l'ID del mittente e del destinatario dal campo 'deletedBy'
   * quando un nuovo messaggio viene inviato, per far riapparire la chat.
   * @param conversationId L'ID della conversazione.
   * @param senderId L'ID dell'utente che invia il messaggio.
   * @param text Il testo del messaggio.
   */
  async sendMessage(conversationId: string, senderId: string, text: string): Promise<void> {
    const messagesCollectionRef = collection(this.afs, `conversations/${conversationId}/messages`);
    const conversationDocRef = doc(this.afs, 'conversations', conversationId);

    try {
      // 1. Aggiungi il nuovo messaggio alla sottocollezione 'messages'
      await addDoc(messagesCollectionRef, {
        senderId: senderId,
        text: text,
        timestamp: serverTimestamp()
      });

      // 2. Ottieni i dati attuali della conversazione per aggiornare 'deletedBy'
      const conversationSnap = await getDoc(conversationDocRef);
      if (!conversationSnap.exists()) {
        console.error('Errore: Conversazione non trovata per l\'invio del messaggio.');
        throw new Error('Conversazione non trovata.');
      }
      const conversationData = conversationSnap.data() as ConversationDocument;
      const participants = conversationData.participants;

      // 3. Rimuovi l'ID di *entrambi* i partecipanti da 'deletedBy'
      // Questo fa "riapparire" la chat per chi l'aveva nascosta
      const undeletePromises: Promise<void>[] = [];
      participants.forEach(participantId => {
        // Usa arrayRemove per rimuovere l'ID del partecipante se presente nell'array 'deletedBy'
        undeletePromises.push(updateDoc(conversationDocRef, {
          deletedBy: arrayRemove(participantId)
        }));
      });
      // Aspetta che tutte le operazioni di rimozione siano completate
      await Promise.all(undeletePromises);

      // 4. Aggiorna la conversazione con l'ultimo messaggio, il suo timestamp e il mittente
      // Marca anche il messaggio come letto per il mittente in `lastRead`
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
          observer.next({ messages, lastVisibleDoc, firstVisibleDoc, hasMore });
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

      return { messages, lastVisibleDoc, firstVisibleDoc: null, hasMore };
    } catch (error) {
      console.error('Errore nel recupero dei messaggi più vecchi:', error);
      throw error;
    }
  }

  /**
   * Ottiene i dettagli di una singola conversazione in tempo reale.
   * @param conversationId L'ID della conversazione.
   * @returns Un Observable che emette i dettagli della conversazione.
   */
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
              deletedBy: data.deletedBy || []
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

  /**
   * Ottiene le conversazioni di un utente in tempo reale, mappandole a ConversationDocument.
   * Questo è un flusso di dati grezzi che verrà arricchito e filtrato dalla ChatListPage.
   * @param userId L'ID dell'utente.
   * @returns Un Observable che emette un array di ConversationDocument.
   */
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

  /**
   * Marca i messaggi di una conversazione come letti per un utente specifico.
   * Aggiorna il timestamp 'lastRead' per l'utente nella conversazione.
   * @param conversationId L'ID della conversazione.
   * @param userId L'ID dell'utente che ha letto i messaggi.
   */
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
      q = query(messagesRef);
    }

    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  /**
   * Marca una conversazione come "eliminata" per un utente specifico aggiungendo il suo UID all'array 'deletedBy'.
   * Questo la nasconderà dalla lista delle chat dell'utente senza cancellarla per gli altri partecipanti.
   * @param conversationId L'ID della conversazione da marcare.
   * @param userId L'ID dell'utente che sta "eliminando" la conversazione.
   */
  async markConversationAsDeleted(conversationId: string, userId: string): Promise<void> {
    const conversationRef = doc(this.afs, 'conversations', conversationId);
    try {
      await updateDoc(conversationRef, {
        deletedBy: arrayUnion(userId) // Aggiungi l'ID dell'utente all'array 'deletedBy'
      });
      console.log(`Conversazione ${conversationId} marcata come eliminata per l'utente ${userId}.`);
    } catch (error) {
      console.error(`Errore nel marcare la conversazione ${conversationId} come eliminata:`, error);
      throw error;
    }
  }
}
