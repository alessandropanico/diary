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
import { getAuth, User } from 'firebase/auth';
import { Observable, from, map, switchMap, forkJoin, of } from 'rxjs';
import { collectionData, docData } from 'rxfire/firestore';

import { UserDataService, UserProfile } from './user-data.service';

// --- Interfacce ---
export interface GroupChat {
  groupId?: string; // ID opzionale, sarà aggiunto da idField
  name: string;
  description?: string;
  photoUrl?: string;
  createdAt: Timestamp;
  createdBy: string;
  members: string[]; // Array di UID dei membri
  lastMessage?: {
    senderId: string;
    text: string;
    timestamp: Timestamp;
  };
  isPrivate?: boolean; // Se il gruppo è privato o pubblico (es. per ricerca)
}

export interface GroupMessage {
  messageId?: string; // ID opzionale, sarà aggiunto dal doc.id
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

  /**
   * Crea un nuovo gruppo chat.
   * Aggiunge il gruppo alla collezione 'groups'.
   * NOTA: A causa delle limitazioni del piano Spark (no Cloud Functions), non possiamo aggiornare
   * le sottocollezioni 'groups' di altri membri direttamente da qui.
   * La lista dei gruppi dell'utente verrà ottenuta interrogando la collezione 'groups' globale.
   * Invia un messaggio di sistema per la creazione del gruppo.
   * @param name Il nome del gruppo.
   * @param description La descrizione del gruppo (opzionale).
   * @param memberUids Un array di UID dei membri iniziali (escluso l'utente corrente, che verrà aggiunto automaticamente).
   * @param photoUrl L'URL della foto del gruppo (opzionale).
   * @returns Una Promise che risolve nell'ID del gruppo creato.
   */
  async createGroup(name: string, description: string = '', memberUids: string[] = [], photoUrl: string = ''): Promise<string> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      console.error('GroupChatService: User not authenticated to create a group.');
      throw new Error('User not authenticated to create a group.');
    }

    // Assicurati che l'utente corrente sia sempre incluso e che non ci siano duplicati
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
      isPrivate: true // Impostazione predefinita per i gruppi creati
    };

    const groupCollectionRef = collection(this.firestore, 'groups');
    try {
      const docRef = await addDoc(groupCollectionRef, newGroup);

      await this.sendMessage(docRef.id, 'system', `${currentUser.displayName || 'Un utente'} ha creato il gruppo.`, 'system');
      return docRef.id;
    } catch (error) {
      console.error('Errore durante la creazione del gruppo:', error);
      throw error;
    }
  }

  /**
   * Invia un messaggio a un gruppo.
   * Aggiorna anche l'ultimo messaggio del documento del gruppo.
   * @param groupId L'ID del gruppo.
   * @param senderId L'ID dell'utente che invia il messaggio.
   * @param text Il testo del messaggio.
   * @param type Il tipo di messaggio ('text', 'image', 'video', 'system').
   * @param imageUrl L'URL dell'immagine (se il tipo è 'image').
   */
  async sendMessage(groupId: string, senderId: string, text: string, type: 'text' | 'image' | 'video' | 'system' = 'text', imageUrl?: string): Promise<void> {
    const groupMessagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);
    const groupDocRef = doc(this.firestore, 'groups', groupId);

    let senderNickname = 'Sistema'; // Default per messaggi di sistema
    if (senderId !== 'system') {
      try {
        const senderProfile: UserProfile | null = await this.userDataService.getUserDataById(senderId);
        senderNickname = senderProfile?.nickname || senderProfile?.name || 'Utente Sconosciuto';
      } catch (error) {
        // ⭐ QUESTO BLOCCO CATCH ⭐
        console.warn(`Impossibile recuperare il nickname per l'utente ${senderId}. Usando 'Utente Sconosciuto'.`, error);
        senderNickname = 'Utente Sconosciuto';
      }
    }

    const newMessage: GroupMessage = {
      senderId: senderId,
      senderNickname: senderNickname, // Usiamo il nickname recuperato (o 'Utente Sconosciuto')
      text,
      timestamp: serverTimestamp() as Timestamp,
      type,
      ...(imageUrl && { imageUrl })
    };

    try {
      await addDoc(groupMessagesCollectionRef, newMessage); // OPERAZIONE 1

      await updateDoc(groupDocRef, { // OPERAZIONE 2 (che abbiamo cercato di proteggere con le regole)
        lastMessage: {
          senderId: newMessage.senderId,
          text: newMessage.text,
          timestamp: serverTimestamp()
        }
      });
    } catch (error) {
      console.error('Errore durante l\'invio del messaggio di gruppo:', error);
      throw error; // <<< Se un errore avviene qui, l'alert si attiva
    }
  }

  /**
   * Ottiene i messaggi più recenti di un gruppo in tempo reale.
   * Utilizzato principalmente per l'ascolto dei nuovi messaggi dopo il caricamento iniziale.
   * Restituisce un Observable di GroupMessage[].
   * @param groupId L'ID del gruppo.
   * @param sinceTimestamp Timestamp dal quale iniziare ad ascoltare (esclusivo).
   * @returns Un Observable di GroupMessage[].
   */
  getNewGroupMessages(groupId: string, sinceTimestamp: Timestamp): Observable<GroupMessage[]> {
    const messagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);
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
        console.error('Errore nell\'ascolto dei nuovi messaggi di gruppo:', error);
        observer.error(error);
      });

      return () => unsubscribe(); // Funzione di cleanup
    });
  }

  /**
   * Carica i messaggi iniziali di un gruppo (i più recenti) con un limite.
   * Questo è un caricamento "una tantum" (getDocs) per il primo set di messaggi.
   * @param groupId L'ID del gruppo.
   * @param limitMessages Numero massimo di messaggi da recuperare.
   * @returns Un Promise che risolve in PagedGroupMessages.
   */
  async getInitialGroupMessages(groupId: string, limitMessages: number = 50): Promise<PagedGroupMessages> {
    const messagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);
    const q = query(messagesCollectionRef, orderBy('timestamp', 'desc'), limit(limitMessages));

    try {
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

      // Inverti per avere i messaggi dal più vecchio al più recente
      return {
        messages: messages.reverse(),
        lastVisibleDoc: lastVisibleDoc,
        hasMore: hasMore
      };
    } catch (error) {
      console.error(`Errore nel caricamento dei messaggi iniziali del gruppo ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Carica i messaggi più vecchi di un gruppo per la paginazione infinita.
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

    try {
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

      // Inverti per avere i messaggi dal più vecchio al più recente
      return {
        messages: messages.reverse(),
        lastVisibleDoc: newLastVisibleDoc,
        hasMore: hasMore
      };
    } catch (error) {
      console.error(`Errore nel caricamento dei messaggi più vecchi del gruppo ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Ottiene i dettagli di un gruppo in tempo reale.
   * @param groupId L'ID del gruppo.
   * @returns Un Observable del documento GroupChat o null se non esiste.
   */
  getGroupDetails(groupId: string): Observable<GroupChat | null> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    return docData(groupDocRef, { idField: 'groupId' }).pipe(
      map(group => (group as GroupChat) || null)
    );
  }

  /**
   * Ottiene la lista dei gruppi a cui un utente appartiene.
   * Non usa più la sottocollezione 'users/{userId}/groups' per la query principale,
   * ma interroga direttamente la collezione 'groups' globale.
   * @param userId L'ID dell'utente.
   * @returns Un Observable di un array di GroupChat.
   */
  getGroupsForUser(userId: string): Observable<GroupChat[]> {
    // ⭐ MODIFICA QUI: Query diretta sulla collezione 'groups' globale
    const groupsCollectionRef = collection(this.firestore, 'groups');
    const q = query(
      groupsCollectionRef,
      where('members', 'array-contains', userId)
      // ATTENZIONE: Se hai bisogno di ordinare per lastMessage.timestamp o altri campi,
      // dovrai creare un indice composto in Firebase Console.
      // Esempio: orderBy('lastMessage.timestamp', 'desc')
      // Se combini `where('members', 'array-contains', userId)` con `orderBy('lastMessage.timestamp', 'desc')`,
      // avrai bisogno di un indice composto su `members` e `lastMessage.timestamp`.
    );

    return collectionData(q, { idField: 'groupId' }).pipe(
      map(groups => {
        // Ordina i gruppi client-side se non puoi farlo direttamente nella query Firestore
        // a causa di limitazioni di indici o query complesse.
        // Fai attenzione alle performance se l'utente ha moltissimi gruppi.
        return (groups as GroupChat[]).sort((a, b) => {
          const timestampA = a.lastMessage?.timestamp?.toMillis() || 0;
          const timestampB = b.lastMessage?.timestamp?.toMillis() || 0;
          return timestampB - timestampA;
        });
      })
    );
  }

  /**
   * Aggiunge un nuovo membro a un gruppo esistente.
   * Aggiorna l'array 'members' del gruppo e la sottocollezione 'groups' dell'utente aggiunto.
   * Invia un messaggio di sistema nel gruppo.
   * @param groupId L'ID del gruppo.
   * @param userIdToAdd L'ID dell'utente da aggiungere.
   */
  async addMemberToGroup(groupId: string, userIdToAdd: string): Promise<void> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    const userGroupDocRef = doc(this.firestore, `users/${userIdToAdd}/groups`, groupId); // Questa scrittura è permessa se userIdToAdd è l'utente corrente

    try {
      // Aggiorna l'array 'members' nel documento del gruppo principale
      await updateDoc(groupDocRef, {
        members: arrayUnion(userIdToAdd)
      });

      // Se l'utente che sta aggiungendo è anche userIdToAdd (cioè sta aggiungendo se stesso o sta agendo come "aggiunto"),
      // questa scrittura sarà permessa dalle regole. Altrimenti, le regole potrebbero bloccarla.
      // Se la chiamata a `addMemberToGroup` può essere fatta da un utente A che aggiunge un utente B,
      // e l'utente B non è l'utente A, allora `setDoc(userGroupDocRef, ...)` fallirà per l'utente B.
      // In questo scenario (no Cloud Functions), l'utente B dovrà "aggiungersi" autonomamente al suo profilo.
      // Per semplicità, si assume che questa funzione venga chiamata dall'utente che sta aggiungendo se stesso
      // o dal creatore del gruppo (che potrebbe aver bisogno di privilegi più ampi se non usi CF).
      // Data l'architettura attuale, questa operazione sulla sottocollezione userGroupDocRef
      // sarà permessa solo se `userIdToAdd` è l'utente autenticato (`request.auth.uid`).
      await setDoc(userGroupDocRef, { joinedAt: serverTimestamp() as Timestamp }, { merge: true });

      const addedUserProfile: UserProfile | null = await this.userDataService.getUserDataById(userIdToAdd);
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
   * Rimuove un membro da un gruppo (azione di un amministratore/creatore).
   * Aggiorna l'array 'members' del gruppo e rimuove il riferimento dalla sottocollezione 'groups' dell'utente rimosso.
   * Invia un messaggio di sistema nel gruppo.
   * @param groupId L'ID del gruppo.
   * @param userIdToRemove L'ID dell'utente da rimuovere.
   */
  async removeMemberFromGroup(groupId: string, userIdToRemove: string): Promise<void> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    const userGroupDocRef = doc(this.firestore, `users/${userIdToRemove}/groups`, groupId); // Questa scrittura è permessa solo se userIdToRemove è l'utente corrente

    try {
      await updateDoc(groupDocRef, {
        members: arrayRemove(userIdToRemove)
      });

      // Questa deleteDoc sarà permessa dalle regole solo se `userIdToRemove` è l'utente autenticato.
      // Se un "amministratore" (creatore del gruppo) tenta di rimuovere un altro utente,
      // questa operazione fallirà con "Missing or insufficient permissions".
      // Con il piano Spark, l'utente rimosso dovrà eliminare manualmente il riferimento dal proprio profilo,
      // oppure dovrai allargare le regole di sicurezza (sconsigliato).
      await deleteDoc(userGroupDocRef);

      const removedUserProfile: UserProfile | null = await this.userDataService.getUserDataById(userIdToRemove);
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
   * Permette a un utente di abbandonare un gruppo.
   * Rimuove l'utente dall'array 'members' del gruppo e cancella il riferimento nella sua sottocollezione 'groups'.
   * Invia un messaggio di sistema nel gruppo.
   * @param groupId L'ID del gruppo da cui l'utente abbandona.
   * @param userId L'ID dell'utente che abbandona.
   */
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    const userGroupDocRef = doc(this.firestore, `users/${userId}/groups`, groupId);

    try {
      await updateDoc(groupDocRef, {
        members: arrayRemove(userId)
      });

      // Questa deleteDoc è permessa in quanto l'utente rimuove il riferimento dal proprio profilo.
      await deleteDoc(userGroupDocRef);

      const leavingUserProfile: UserProfile | null = await this.userDataService.getUserDataById(userId);
      const leavingUserName = leavingUserProfile?.nickname || leavingUserProfile?.name || 'Un utente';
      await this.sendMessage(groupId, 'system', `${leavingUserName} ha abbandonato il gruppo.`, 'system');

    } catch (error) {
      console.error(`Errore nell'abbandonare il gruppo ${groupId} per l'utente ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Ottiene i dati dei profili dei membri di un gruppo.
   * @param groupId L'ID del gruppo.
   * @returns Un Observable di un array di UserProfile.
   */
  getGroupMembersData(groupId: string): Observable<UserProfile[]> {
    return this.getGroupDetails(groupId).pipe(
      switchMap(group => {
        if (!group || !group.members || group.members.length === 0) {
          return of([]);
        }
        // Recupera i profili di tutti i membri in parallelo
        const memberPromises = group.members.map(uid => this.userDataService.getUserDataById(uid));
        return from(Promise.all(memberPromises)).pipe(
          // Filtra i profili nulli se qualche utente non esiste più (sebbene raro)
          map(members => members.filter(Boolean) as UserProfile[])
        );
      })
    );
  }

  /**
   * Aggiorna i dettagli di un gruppo (nome, descrizione, foto, etc.).
   * @param groupId L'ID del gruppo da aggiornare.
   * @param updates Un oggetto Partial<GroupChat> con i campi da aggiornare.
   */
  async updateGroupDetails(groupId: string, updates: Partial<GroupChat>): Promise<void> {
    const groupDocRef = doc(this.firestore, 'groups', groupId);
    try {
      await updateDoc(groupDocRef, updates);
    } catch (error) {
      console.error(`Errore nell'aggiornare i dettagli del gruppo ${groupId}:`, error);
      throw error;
    }
  }

 /**
   * Marca tutti i messaggi di un gruppo come letti per un utente specifico.
   * Aggiorna il timestamp dell'ultima lettura nella sottocollezione 'groups' dell'utente.
   * @param groupId L'ID del gruppo.
   * @param userId L'ID dell'utente.
   * @param timestamp L'ultimo timestamp di messaggio da registrare come "letto".
    * Se non fornito, verrà usato serverTimestamp().
   */
  async markGroupMessagesAsRead(groupId: string, userId: string, timestamp: Timestamp | null = null): Promise<void> {
    const userGroupDocRef = doc(this.firestore, `users/${userId}/groups`, groupId);
    try {
      await setDoc(userGroupDocRef, {
        // Usa il timestamp fornito, altrimenti serverTimestamp()
        lastReadMessageTimestamp: timestamp || serverTimestamp() as Timestamp
      }, { merge: true });
    } catch (error: any) {
      console.error('Errore nel marcare i messaggi di gruppo come letti:', error);
      throw error;
    }
  }

  /**
   * Ottiene il timestamp dell'ultima lettura di un utente per un gruppo specifico.
   * @param groupId L'ID del gruppo.
   * @param userId L'ID dell'utente.
   * @returns Un Observable del Timestamp dell'ultima lettura, o null se non presente.
   */
  getLastReadTimestamp(groupId: string, userId: string): Observable<Timestamp | null> {
    const userGroupDocRef = doc(this.firestore, `users/${userId}/groups`, groupId);
    return docData(userGroupDocRef).pipe(
      map(data => (data ? (data['lastReadMessageTimestamp'] as Timestamp) || null : null))
    );
  }

  /**
   * Conta i messaggi non letti per un utente in un gruppo specifico.
   * @param groupId L'ID del gruppo.
   * @param userId L'ID dell'utente.
   * @param lastReadTimestamp Il Timestamp dell'ultimo messaggio letto dall'utente.
   * @returns Una Promise che risolve nel numero di messaggi non letti.
   */
  async countUnreadMessagesForGroup(
    groupId: string,
    userId: string,
    lastReadTimestamp: Timestamp | null
  ): Promise<number> {
    const messagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);
    let q;

    if (lastReadTimestamp) {
      q = query(
        messagesCollectionRef,
        where('timestamp', '>', lastReadTimestamp),
        orderBy('timestamp', 'asc')
      );
    } else {
      q = query(messagesCollectionRef);
    }

    try {
      const querySnapshot = await getDocs(q);
      let unreadCount = 0;
      querySnapshot.forEach(doc => {
        const message = doc.data() as GroupMessage;
        if (message.type !== 'system' && message.senderId !== userId) {
          unreadCount++;
        }
      });
      return unreadCount;
    } catch (error) {
      console.error(`Errore nel contare i messaggi non letti per il gruppo ${groupId} per l'utente ${userId}:`, error);
      return 0;
    }
  }
}
