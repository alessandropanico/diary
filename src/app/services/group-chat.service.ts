// src/app/services/group-chat.service.ts

import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  setDoc,
  deleteDoc,
  Timestamp,
  startAfter, // ⭐ NUOVO: Importa startAfter per la paginazione ⭐
  QueryDocumentSnapshot // ⭐ NUOVO: Importa QueryDocumentSnapshot ⭐
} from '@angular/fire/firestore';
import { getAuth } from 'firebase/auth';
import { Observable, from, map, switchMap, forkJoin, of } from 'rxjs';
import { collectionData, docData } from 'rxfire/firestore';

// ⭐ IMPORTAZIONE CORRETTA: UserDashboardCounts è la tua interfaccia principale ⭐
import { UserDataService, UserDashboardCounts } from './user-data.service';

// --- Interfacce per Chat di Gruppo ---

// Interfaccia per un gruppo di chat
export interface GroupChat {
  groupId?: string; // Opzionale perché generato da Firestore
  name: string;
  description?: string;
  photoUrl?: string;
  createdAt: Timestamp; // Usiamo Timestamp di Firebase
  createdBy: string; // UID del creatore
  members: string[]; // Array di UID degli utenti che fanno parte del gruppo
  lastMessage?: { // Dettagli dell'ultimo messaggio (per visualizzazione nella lista chat)
    senderId: string;
    text: string;
    timestamp: Timestamp; // Usiamo Timestamp di Firebase
  };
  isPrivate?: boolean; // Opzionale: true se è un gruppo privato (solo su invito), false se pubblico
}

// Interfaccia per un messaggio di gruppo
export interface GroupMessage {
  messageId?: string; // Opzionale perché generato da Firestore
  senderId: string;
  senderNickname: string; // Per visualizzazione diretta
  text: string;
  timestamp: Timestamp; // Usiamo Timestamp di Firebase
  type: 'text' | 'image' | 'video' | 'system'; // Es: "text", "image", "video", "system"
  imageUrl?: string; // Se type è 'image'
  // Altri campi come 'readBy' o 'reactions' possono essere aggiunti in futuro
}

// ⭐ NUOVA INTERFACCIA: Per la paginazione dei messaggi ⭐
export interface PagedGroupMessages {
  messages: GroupMessage[];
  lastVisibleDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

// --- Fine Interfacce ---

@Injectable({
  providedIn: 'root'
})
export class GroupChatService {
  private auth = getAuth(); // Ottiene l'istanza di Firebase Auth

  constructor(
    private firestore: Firestore, // Inietta Firestore
    private userDataService: UserDataService // Inietta UserDataService per ottenere i dettagli degli utenti
  ) {}

  /**
   * Crea un nuovo gruppo di chat.
   * @param name Nome del gruppo.
   * @param description Descrizione opzionale.
   * @param memberUids Array di UID dei membri iniziali da aggiungere (oltre al creatore).
   * @param photoUrl URL della foto del gruppo (opzionale).
   * @returns L'ID del gruppo appena creato.
   */
  async createGroup(name: string, description: string = '', memberUids: string[] = [], photoUrl: string = ''): Promise<string> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated to create a group.');

    const initialMembers = Array.from(new Set([currentUser.uid, ...memberUids.filter(uid => uid !== currentUser.uid)])); // Evita duplicati

    const newGroup: GroupChat = {
      name,
      description,
      photoUrl,
      createdAt: serverTimestamp() as Timestamp, // Firestore popolerà questo
      createdBy: currentUser.uid,
      members: initialMembers,
      lastMessage: { // Messaggio di sistema iniziale
        senderId: 'system',
        text: `${currentUser.displayName || 'Un utente'} ha creato il gruppo.`,
        timestamp: serverTimestamp() as Timestamp
      },
      isPrivate: true // Assumiamo privato per default, puoi renderlo configurabile
    };

    const groupCollectionRef = collection(this.firestore, 'groups');
    const docRef = await addDoc(groupCollectionRef, newGroup);

    // Per ogni membro iniziale, aggiungi un riferimento nella sottocollezione users/{userId}/groups
    for (const memberId of initialMembers) {
      const userGroupDocRef = doc(this.firestore, `users/${memberId}/groups`, docRef.id);
      await setDoc(userGroupDocRef, {
        joinedAt: serverTimestamp() as Timestamp,
        // Potresti aggiungere altri metadati qui, es. 'lastReadMessageTimestamp'
      });
    }

    // Aggiungi un messaggio di sistema per la creazione del gruppo
    await this.sendMessage(docRef.id, 'system', `${currentUser.displayName || 'Un utente'} ha creato il gruppo.`, 'system');

    return docRef.id; // Ritorna l'ID del nuovo gruppo
  }

  /**
   * Invia un messaggio a un gruppo specifico.
   * Aggiorna anche l'ultimo messaggio nel documento del gruppo.
   * @param groupId L'ID del gruppo.
   * @param senderId L'ID dell'utente che invia il messaggio.
   * @param text Il testo del messaggio.
   * @param type Il tipo di messaggio (es. 'text', 'image', 'system').
   * @param imageUrl L'URL dell'immagine se il tipo è 'image'.
   */
  async sendMessage(groupId: string, senderId: string, text: string, type: 'text' | 'image' | 'video' | 'system' = 'text', imageUrl?: string): Promise<void> {
    const groupMessagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);
    const groupDocRef = doc(this.firestore, 'groups', groupId);

    const newMessage: GroupMessage = {
      senderId: senderId,
      senderNickname: '', // Verrà popolato sotto con il nickname reale
      text,
      timestamp: serverTimestamp() as Timestamp,
      type,
      ...(imageUrl && { imageUrl }) // Aggiunge imageUrl solo se presente
    };

    // Recupera il nickname del mittente per memorizzarlo nel messaggio (utile per visualizzazione)
    if (senderId !== 'system') { // 'system' non ha un profilo utente
      // ⭐ UTILIZZO CORRETTO DI UserDashboardCounts ⭐
      const senderProfile: UserDashboardCounts | null = await this.userDataService.getUserDataById(senderId);
      newMessage.senderNickname = senderProfile?.nickname || senderProfile?.name || 'Utente Sconosciuto';
    } else {
      newMessage.senderNickname = 'Sistema'; // Per i messaggi di sistema
    }

    try {
      await addDoc(groupMessagesCollectionRef, newMessage);

      // Aggiorna l'ultimo messaggio nel documento del gruppo
      await updateDoc(groupDocRef, {
        lastMessage: {
          senderId: newMessage.senderId,
          text: newMessage.text,
          timestamp: newMessage.timestamp // Usiamo lo stesso timestamp del messaggio
        }
      });
    } catch (error) {
      console.error('Errore durante l\'invio del messaggio di gruppo:', error);
      throw error;
    }
  }

  /**
   * Ottiene i messaggi più recenti di un gruppo in tempo reale con paginazione.
   * Questo metodo è per il caricamento iniziale e l'ascolto dei nuovi messaggi.
   * Restituisce un Observable di PagedGroupMessages.
   *
   * @param groupId L'ID del gruppo.
   * @param limitMessages Numero massimo di messaggi da recuperare inizialmente.
   * @returns Un Observable di PagedGroupMessages.
   */
  getGroupMessages(groupId: string, limitMessages: number = 50): Observable<PagedGroupMessages> {
    const messagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);
    // Ordina in modo decrescente per ottenere i messaggi più recenti e poi inverti nel componente per 'asc'
    const q = query(messagesCollectionRef, orderBy('timestamp', 'desc'), limit(limitMessages));

    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages: GroupMessage[] = [];
        let lastVisibleDoc: QueryDocumentSnapshot | null = null;

        snapshot.forEach(doc => {
          messages.push({ messageId: doc.id, ...doc.data() } as GroupMessage);
        });

        // L'ultimo documento visibile è l'ultimo del set recuperato (il più "vecchio" se ordinato in desc)
        if (snapshot.docs.length > 0) {
          lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        }

        // Controlla se ci sono più messaggi solo se il numero di messaggi recuperati è uguale al limite
        const hasMore = snapshot.docs.length === limitMessages;

        // Inverti i messaggi qui per averli in ordine cronologico ascendente nel componente
        observer.next({
          messages: messages.reverse(),
          lastVisibleDoc: lastVisibleDoc,
          hasMore: hasMore
        });
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Carica i messaggi più vecchi di un gruppo per la paginazione infinita.
   *
   * @param groupId L'ID del gruppo.
   * @param limitMessages Numero di messaggi da recuperare.
   * @param lastVisibleDoc Il QueryDocumentSnapshot dell'ultimo messaggio visibile finora.
   * @returns Un Promise che risolve in PagedGroupMessages.
   */
  async getOlderGroupMessages(groupId: string, limitMessages: number, lastVisibleDoc: QueryDocumentSnapshot): Promise<PagedGroupMessages> {
    const messagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);
    // Query per i messaggi più vecchi (ordinati in modo decrescente, partendo da after lastVisibleDoc)
    const q = query(
      messagesCollectionRef,
      orderBy('timestamp', 'desc'),
      startAfter(lastVisibleDoc),
      limit(limitMessages)
    );

    const querySnapshot = await getDocs(q);
    const messages: GroupMessage[] = [];
    let newLastVisibleDoc: QueryDocumentSnapshot | null = null;

    querySnapshot.forEach(doc => {
      messages.push({ messageId: doc.id, ...doc.data() } as GroupMessage);
    });

    if (querySnapshot.docs.length > 0) {
      newLastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
    }

    const hasMore = querySnapshot.docs.length === limitMessages;

    return {
      messages: messages.reverse(), // Inverti per mantenere l'ordine cronologico corretto
      lastVisibleDoc: newLastVisibleDoc,
      hasMore: hasMore
    };
  }

  /**
   * Ottiene i dettagli di un singolo gruppo in tempo reale.
   * @param groupId L'ID del gruppo.
   * @returns Un Observable di GroupChat o null se non trovato.
   */
  getGroupDetails(groupId: string): Observable<GroupChat | null> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    return docData(groupDocRef, { idField: 'groupId' }).pipe(
      map(group => group as GroupChat || null)
    );
  }

  /**
   * Ottiene i gruppi a cui un utente specifico appartiene.
   * Verranno recuperati i dettagli completi dei gruppi.
   * @param userId L'ID dell'utente.
   * @returns Un Observable di array di GroupChat.
   */
  getGroupsForUser(userId: string): Observable<GroupChat[]> {
    // Query sulla sottocollezione users/{userId}/groups per ottenere gli ID dei gruppi
    const userGroupsCollectionRef = collection(this.firestore, `users/${userId}/groups`);

    return collectionData(userGroupsCollectionRef, { idField: 'groupId' }).pipe( // `groupId` sarà l'ID del documento della sottocollezione
      switchMap(userGroupDocs => {
        const groupIds = userGroupDocs.map(doc => doc.groupId); // Estrai gli ID dei gruppi

        if (groupIds.length === 0) {
          return of([]); // Nessun gruppo, ritorna un Observable vuoto
        }

        // Ora, per ogni groupId, recupera i dettagli completi dalla collezione 'groups'
        const groupPromises = groupIds.map(id => getDoc(doc(this.firestore, 'groups', id)));
        return from(Promise.all(groupPromises)).pipe(
          map(groupDocs => {
            const groups: GroupChat[] = [];
            groupDocs.forEach(groupDoc => {
              if (groupDoc.exists()) {
                groups.push({ groupId: groupDoc.id, ...groupDoc.data() } as GroupChat);
              }
            });
            // Ordina i gruppi in base all'ultimo messaggio (il più recente in cima)
            return groups.sort((a, b) => {
              const timestampA = a.lastMessage?.timestamp?.toDate().getTime() || 0;
              const timestampB = b.lastMessage?.timestamp?.toDate().getTime() || 0;
              return timestampB - timestampA;
            });
          })
        );
      })
    );
  }

  /**
   * Aggiunge un membro a un gruppo.
   * Aggiorna il campo `members` nel documento del gruppo e aggiunge il riferimento `users/{userId}/groups`.
   * @param groupId L'ID del gruppo.
   * @param userIdToAdd L'ID dell'utente da aggiungere.
   */
  async addMemberToGroup(groupId: string, userIdToAdd: string): Promise<void> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    try {
      await updateDoc(groupDocRef, {
        members: arrayUnion(userIdToAdd) // Aggiunge l'UID al campo 'members'
      });

      // Aggiungi anche il riferimento nella sottocollezione users/{userId}/groups
      const userGroupDocRef = doc(this.firestore, `users/${userIdToAdd}/groups`, groupId);
      await setDoc(userGroupDocRef, { joinedAt: serverTimestamp() as Timestamp });

      // Invia un messaggio di sistema per notificare l'aggiunta
      // ⭐ UTILIZZO CORRETTO DI UserDashboardCounts ⭐
      const addedUserProfile: UserDashboardCounts | null = await this.userDataService.getUserDataById(userIdToAdd);
      const addedUserName = addedUserProfile?.nickname || addedUserProfile?.name || 'Un utente';
      const currentUser = this.auth.currentUser;
      const currentUserName = currentUser?.displayName || 'Qualcuno';
      await this.sendMessage(groupId, 'system', `${currentUserName} ha aggiunto ${addedUserName} al gruppo.`, 'system');

    } catch (error) {
      console.error(`Errore nell'aggiungere il membro ${userIdToAdd} al gruppo ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Rimuove un membro da un gruppo.
   * Aggiorna il campo `members` nel documento del gruppo e rimuove il riferimento `users/{userId}/groups`.
   * @param groupId L'ID del gruppo.
   * @param userIdToRemove L'ID dell'utente da rimuovere.
   */
  async removeMemberFromGroup(groupId: string, userIdToRemove: string): Promise<void> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    try {
      await updateDoc(groupDocRef, {
        members: arrayRemove(userIdToRemove) // Rimuove l'UID dal campo 'members'
      });

      // Rimuovi anche il riferimento dalla sottocollezione users/{userId}/groups
      const userGroupDocRef = doc(this.firestore, `users/${userIdToRemove}/groups`, groupId);
      await deleteDoc(userGroupDocRef);

      // Invia un messaggio di sistema per notificare la rimozione
      // ⭐ UTILIZZO CORRETTO DI UserDashboardCounts ⭐
      const removedUserProfile: UserDashboardCounts | null = await this.userDataService.getUserDataById(userIdToRemove);
      const removedUserName = removedUserProfile?.nickname || removedUserProfile?.name || 'Un utente';
      const currentUser = this.auth.currentUser;
      const currentUserName = currentUser?.displayName || 'Qualcuno';
      await this.sendMessage(groupId, 'system', `${currentUserName} ha rimosso ${removedUserName} dal gruppo.`, 'system');

    } catch (error) {
      console.error(`Errore nel rimuovere il membro ${userIdToRemove} dal gruppo ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Ottiene i dati completi dei membri di un gruppo.
   * @param groupId L'ID del gruppo.
   * @returns Un Observable di array di UserDashboardCounts.
   */
  getGroupMembersData(groupId: string): Observable<UserDashboardCounts[]> {
    return this.getGroupDetails(groupId).pipe(
      switchMap(group => {
        if (!group || group.members.length === 0) {
          return of([]);
        }
        // Recupera i dettagli di ogni membro usando UserDataService
        // ⭐ UTILIZZO CORRETTO DI UserDashboardCounts ⭐
        const memberPromises = group.members.map(uid => this.userDataService.getUserDataById(uid));
        return from(Promise.all(memberPromises)).pipe(
          map(members => members.filter(Boolean) as UserDashboardCounts[]) // Filtra eventuali null/undefined e casta
        );
      })
    );
  }

  /**
   * Aggiorna i dettagli di un gruppo (nome, descrizione, foto).
   * @param groupId L'ID del gruppo da aggiornare.
   * @param updates Oggetto con i campi da aggiornare.
   */
  async updateGroupDetails(groupId: string, updates: Partial<GroupChat>): Promise<void> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    try {
      await updateDoc(groupDocRef, updates);
      console.log(`Dettagli del gruppo ${groupId} aggiornati.`);
    } catch (error) {
      console.error(`Errore nell'aggiornare i dettagli del gruppo ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Segna l'ultimo messaggio letto da un utente in un gruppo.
   * Questo può essere usato per calcolare i messaggi non letti per ogni utente.
   * @param groupId L'ID del gruppo.
   * @param userId L'ID dell'utente.
   */
  async markGroupMessagesAsRead(groupId: string, userId: string): Promise<void> {
    const userGroupDocRef = doc(this.firestore, `users/${userId}/groups`, groupId);
    try {
      await setDoc(userGroupDocRef, { // Usiamo setDoc con merge: true per non sovrascrivere altri campi
        lastReadMessageTimestamp: serverTimestamp() as Timestamp
      }, { merge: true });
      console.log(`Gruppo ${groupId} marcato come letto per utente ${userId}.`);
    } catch (error: any) {
      console.error('Errore nel marcare i messaggi di gruppo come letti:', error);
      throw error;
    }
  }

  /**
   * Recupera il timestamp dell'ultimo messaggio letto da un utente in un gruppo.
   * @param groupId L'ID del gruppo.
   * @param userId L'ID dell'utente.
   * @returns Observable del Timestamp o null.
   */
  getLastReadTimestamp(groupId: string, userId: string): Observable<Timestamp | null> {
    const userGroupDocRef = doc(this.firestore, `users/${userId}/groups`, groupId);
    return docData(userGroupDocRef).pipe(
      map(data => (data ? (data['lastReadMessageTimestamp'] as Timestamp) || null : null))
    );
  }
}
