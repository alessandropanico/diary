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
  startAfter,
  QueryDocumentSnapshot
} from '@angular/fire/firestore';
import { getAuth } from 'firebase/auth';
import { Observable, from, map, switchMap, forkJoin, of } from 'rxjs';
import { collectionData, docData } from 'rxfire/firestore';

import { UserDataService, UserDashboardCounts } from './user-data.service';

export interface GroupChat {
  groupId?: string;
  name: string;
  description?: string;
  photoUrl?: string;
  createdAt: Timestamp;
  createdBy: string;
  members: string[];
  lastMessage?: {
    senderId: string;
    text: string;
    timestamp: Timestamp;
  };
  isPrivate?: boolean;
}

export interface GroupMessage {
  messageId?: string;
  senderId: string;
  senderNickname: string;
  text: string;
  timestamp: Timestamp;
  type: 'text' | 'image' | 'video' | 'system';
  imageUrl?: string;
}

export interface PagedGroupMessages {
  messages: GroupMessage[];
  lastVisibleDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  // ⭐ Non è strettamente necessario per l'infinite scroll "verso l'alto",
  // ma potresti aggiungerlo se in futuro volessi scrollare "verso il basso" per nuovi messaggi
  // firstVisibleDoc?: QueryDocumentSnapshot | null;
}

@Injectable({
  providedIn: 'root'
})
export class GroupChatService {
  private auth = getAuth();

  constructor(
    private firestore: Firestore,
    private userDataService: UserDataService
  ) {}

  async createGroup(name: string, description: string = '', memberUids: string[] = [], photoUrl: string = ''): Promise<string> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated to create a group.');

    const initialMembers = Array.from(new Set([currentUser.uid, ...memberUids.filter(uid => uid !== currentUser.uid)]));

    const newGroup: GroupChat = {
      name,
      description,
      photoUrl,
      createdAt: serverTimestamp() as Timestamp,
      createdBy: currentUser.uid,
      members: initialMembers,
      lastMessage: {
        senderId: 'system',
        text: `${currentUser.displayName || 'Un utente'} ha creato il gruppo.`,
        timestamp: serverTimestamp() as Timestamp
      },
      isPrivate: true
    };

    const groupCollectionRef = collection(this.firestore, 'groups');
    const docRef = await addDoc(groupCollectionRef, newGroup);

    for (const memberId of initialMembers) {
      const userGroupDocRef = doc(this.firestore, `users/${memberId}/groups`, docRef.id);
      await setDoc(userGroupDocRef, {
        joinedAt: serverTimestamp() as Timestamp,
      });
    }

    await this.sendMessage(docRef.id, 'system', `${currentUser.displayName || 'Un utente'} ha creato il gruppo.`, 'system');

    return docRef.id;
  }

  async sendMessage(groupId: string, senderId: string, text: string, type: 'text' | 'image' | 'video' | 'system' = 'text', imageUrl?: string): Promise<void> {
    const groupMessagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);
    const groupDocRef = doc(this.firestore, 'groups', groupId);

    const newMessage: GroupMessage = {
      senderId: senderId,
      senderNickname: '',
      text,
      timestamp: serverTimestamp() as Timestamp,
      type,
      ...(imageUrl && { imageUrl })
    };

    if (senderId !== 'system') {
      const senderProfile: UserDashboardCounts | null = await this.userDataService.getUserDataById(senderId);
      newMessage.senderNickname = senderProfile?.nickname || senderProfile?.name || 'Utente Sconosciuto';
    } else {
      newMessage.senderNickname = 'Sistema';
    }

    try {
      await addDoc(groupMessagesCollectionRef, newMessage);

      await updateDoc(groupDocRef, {
        lastMessage: {
          senderId: newMessage.senderId,
          text: newMessage.text,
          timestamp: newMessage.timestamp
        }
      });
    } catch (error) {
      console.error('Errore durante l\'invio del messaggio di gruppo:', error);
      throw error;
    }
  }

  /**
   * Ottiene i messaggi più recenti di un gruppo in tempo reale.
   * Utilizzato principalmente per l'ascolto dei nuovi messaggi dopo il caricamento iniziale.
   * Restituisce un Observable di GroupMessage[].
   *
   * @param groupId L'ID del gruppo.
   * @param sinceTimestamp Timestamp dal quale iniziare ad ascoltare (esclusivo).
   * @returns Un Observable di GroupMessage[].
   */
  getNewGroupMessages(groupId: string, sinceTimestamp: Timestamp): Observable<GroupMessage[]> {
    const messagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);
    // Ascolta solo i messaggi più recenti dell'ultimo timestamp caricato
    const q = query(
      messagesCollectionRef,
      where('timestamp', '>', sinceTimestamp),
      orderBy('timestamp', 'asc')
    );

    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages: GroupMessage[] = [];
        snapshot.forEach(doc => {
          messages.push({ messageId: doc.id, ...doc.data() } as GroupMessage);
        });
        observer.next(messages);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Carica i messaggi iniziali di un gruppo (i più recenti) con un limite.
   * Questo è un caricamento "una tantum" (getDocs) per il primo set di messaggi.
   *
   * @param groupId L'ID del gruppo.
   * @param limitMessages Numero massimo di messaggi da recuperare.
   * @returns Un Promise che risolve in PagedGroupMessages.
   */
  async getInitialGroupMessages(groupId: string, limitMessages: number = 50): Promise<PagedGroupMessages> {
    const messagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);
    const q = query(messagesCollectionRef, orderBy('timestamp', 'desc'), limit(limitMessages));

    const querySnapshot = await getDocs(q);
    const messages: GroupMessage[] = [];
    let lastVisibleDoc: QueryDocumentSnapshot | null = null;

    querySnapshot.forEach(doc => {
      messages.push({ messageId: doc.id, ...doc.data() } as GroupMessage);
    });

    if (querySnapshot.docs.length > 0) {
      lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
    }

    const hasMore = querySnapshot.docs.length === limitMessages;

    return {
      messages: messages.reverse(), // Inverti per averli in ordine cronologico ascendente
      lastVisibleDoc: lastVisibleDoc,
      hasMore: hasMore
    };
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
      messages: messages.reverse(),
      lastVisibleDoc: newLastVisibleDoc,
      hasMore: hasMore
    };
  }

  getGroupDetails(groupId: string): Observable<GroupChat | null> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    return docData(groupDocRef, { idField: 'groupId' }).pipe(
      map(group => group as GroupChat || null)
    );
  }

  getGroupsForUser(userId: string): Observable<GroupChat[]> {
    const userGroupsCollectionRef = collection(this.firestore, `users/${userId}/groups`);

    return collectionData(userGroupsCollectionRef, { idField: 'groupId' }).pipe(
      switchMap(userGroupDocs => {
        const groupIds = userGroupDocs.map(doc => doc.groupId);

        if (groupIds.length === 0) {
          return of([]);
        }

        const groupPromises = groupIds.map(id => getDoc(doc(this.firestore, 'groups', id)));
        return from(Promise.all(groupPromises)).pipe(
          map(groupDocs => {
            const groups: GroupChat[] = [];
            groupDocs.forEach(groupDoc => {
              if (groupDoc.exists()) {
                groups.push({ groupId: groupDoc.id, ...groupDoc.data() } as GroupChat);
              }
            });
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

  async addMemberToGroup(groupId: string, userIdToAdd: string): Promise<void> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    try {
      await updateDoc(groupDocRef, {
        members: arrayUnion(userIdToAdd)
      });

      const userGroupDocRef = doc(this.firestore, `users/${userIdToAdd}/groups`, groupId);
      await setDoc(userGroupDocRef, { joinedAt: serverTimestamp() as Timestamp });

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

  async removeMemberFromGroup(groupId: string, userIdToRemove: string): Promise<void> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    try {
      await updateDoc(groupDocRef, {
        members: arrayRemove(userIdToRemove)
      });

      const userGroupDocRef = doc(this.firestore, `users/${userIdToRemove}/groups`, groupId);
      await deleteDoc(userGroupDocRef);

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

  getGroupMembersData(groupId: string): Observable<UserDashboardCounts[]> {
    return this.getGroupDetails(groupId).pipe(
      switchMap(group => {
        if (!group || group.members.length === 0) {
          return of([]);
        }
        const memberPromises = group.members.map(uid => this.userDataService.getUserDataById(uid));
        return from(Promise.all(memberPromises)).pipe(
          map(members => members.filter(Boolean) as UserDashboardCounts[])
        );
      })
    );
  }

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

  async markGroupMessagesAsRead(groupId: string, userId: string): Promise<void> {
    const userGroupDocRef = doc(this.firestore, `users/${userId}/groups`, groupId);
    try {
      await setDoc(userGroupDocRef, {
        lastReadMessageTimestamp: serverTimestamp() as Timestamp
      }, { merge: true });
      console.log(`Gruppo ${groupId} marcato come letto per utente ${userId}.`);
    } catch (error: any) {
      console.error('Errore nel marcare i messaggi di gruppo come letti:', error);
      throw error;
    }
  }

  getLastReadTimestamp(groupId: string, userId: string): Observable<Timestamp | null> {
    const userGroupDocRef = doc(this.firestore, `users/${userId}/groups`, groupId);
    return docData(userGroupDocRef).pipe(
      map(data => (data ? (data['lastReadMessageTimestamp'] as Timestamp) || null : null))
    );
  }
}
