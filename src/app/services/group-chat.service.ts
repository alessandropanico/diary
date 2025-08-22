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
  QueryDocumentSnapshot,
  writeBatch
} from '@angular/fire/firestore';
import { getAuth, User } from 'firebase/auth';
import { Observable, from, map, switchMap, forkJoin, of } from 'rxjs';
import { collectionData, docData } from 'rxfire/firestore';

import { UserDataService, UserProfile } from './user-data.service';
import { Post } from 'src/app/interfaces/post'; // ⭐ IMPORT NECESSARIO ⭐

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
  type: 'text' | 'image' | 'video' | 'system' | 'post';
  imageUrl?: string;
  postData?: SharedPostData; // Aggiunto per i messaggi di tipo 'post'
}

export interface SharedPostData {
  id: string; // ID del post condiviso
  username: string; // Nickname dell'utente che ha creato il post
  userAvatarUrl: string; // URL dell'avatar dell'utente
  text: string; // Testo del post
  imageUrl?: string; // URL dell'immagine del post (opzionale)
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
  ) { }

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
      console.error('GroupChatService: User not authenticated to create a group. Aborting.');
      throw new Error('User not authenticated to create a group.');
    }

    // ⭐️ RECUPERA IL PROFILO UTENTE PER IL NICKNAME ⭐️
    const currentUserProfile = await this.userDataService.getUserDataById(currentUser.uid);
    const userNickname = currentUserProfile?.nickname || currentUserProfile?.name || 'Un utente';

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
        text: `${userNickname} ha creato il gruppo.`, // ⭐️ USA IL NICKNAME QUI ⭐️
        timestamp: serverTimestamp() as Timestamp
      },
      isPrivate: true
    };

    const groupCollectionRef = collection(this.firestore, 'groups');
    try {
      const docRef = await addDoc(groupCollectionRef, newGroup);

      // ⭐️ USA IL NICKNAME NEL MESSAGGIO DI SISTEMA ⭐️
      await this.sendMessage(docRef.id, 'system', `${userNickname} ha creato il gruppo.`, 'system');
      return docRef.id;
    } catch (error) {
      console.error('ERRORE durante la creazione del gruppo:', error);
      console.error('Controlla le regole di sicurezza per la creazione (allow create) di documenti nella collezione "groups".');
      throw error;
    }
  }

/**
 * Invia un messaggio a un gruppo.
 * Aggiorna anche l'ultimo messaggio del documento del gruppo.
 * @param groupId L'ID del gruppo.
 * @param senderId L'ID dell'utente che invia il messaggio.
 * @param text Il testo del messaggio.
 * @param type Il tipo di messaggio ('text', 'image', 'video', 'system', 'post').
 * @param data Un oggetto opzionale per dati aggiuntivi (es. { imageUrl?: string; postData?: SharedPostData }).
 * @param mentions Un array opzionale di ID utente menzionati.
 * @param systemSenderNickname Un nickname opzionale per i messaggi di sistema.
 */
async sendMessage(
  groupId: string,
  senderId: string,
  text: string,
  type: 'text' | 'image' | 'video' | 'system' | 'post' = 'text',
  data?: { imageUrl?: string; postData?: any },
  mentions?: string[],
  systemSenderNickname?: string
): Promise<void> {
  const groupMessagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);
  const groupDocRef = doc(this.firestore, 'groups', groupId);

  let senderNickname = 'Sistema';
  if (senderId !== 'system') {
    try {
      const senderProfile: UserProfile | null = await this.userDataService.getUserDataById(senderId);
      senderNickname = senderProfile?.nickname || senderProfile?.name || 'Utente Sconosciuto';
    } catch (error) {
      console.warn(`WARN: Impossibile recuperare il nickname per l'utente ${senderId}. Usando 'Utente Sconosciuto'. Errore:`, error);
      senderNickname = 'Utente Sconosciuto';
    }
  } else {
    if (systemSenderNickname) {
      senderNickname = systemSenderNickname;
    } else {
      senderNickname = 'Sistema';
    }
  }

  // ⭐⭐ LOGICA CORRETTA PER IL TESTO DELL'ANTEPRIMA ⭐⭐
  let lastMessageText: string = text;
  if (type === 'post' && data?.postData) {
    const postTextPreview = data.postData.text ? data.postData.text.substring(0, 50) + '...' : 'Nessuna descrizione';
    lastMessageText = `Post condiviso: "${postTextPreview}"`;
  } else if (type === 'image') {
    lastMessageText = 'Immagine';
  } else if (type === 'video') {
    lastMessageText = 'Video';
  }

  const newMessage: GroupMessage = {
    senderId: senderId,
    senderNickname: senderNickname,
    text,
    timestamp: serverTimestamp() as Timestamp,
    type,
    ...(data?.imageUrl && { imageUrl: data.imageUrl }),
    ...(data?.postData && { postData: data.postData }),
    ...(mentions && mentions.length > 0 && { mentions: mentions })
  };

  try {
    await addDoc(groupMessagesCollectionRef, newMessage);
    const lastMessageData = {
      senderId: newMessage.senderId,
      text: lastMessageText, // ⭐⭐ Usa il testo di anteprima corretto ⭐⭐
      timestamp: serverTimestamp()
    };
    await updateDoc(groupDocRef, {
      lastMessage: lastMessageData
    });
  } catch (error) {
    console.error('ERRORE CRITICO durante l\'invio o l\'aggiornamento del messaggio di gruppo:', error);
    throw error;
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

      return () => {
        unsubscribe(); // Funzione di cleanup
      };
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
      } else {
      }

      const hasMore = querySnapshot.docs.length === limitMessages;

      // Inverti per avere i messaggi dal più vecchio al più recente
      const result = {
        messages: messages.reverse(),
        lastVisibleDoc: lastVisibleDoc,
        hasMore: hasMore
      };
      return result;
    } catch (error) {
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
      } else {
      }

      const hasMore = querySnapshot.docs.length === limitMessages;

      // Inverti per avere i messaggi dal più vecchio al più recente
      const result = {
        messages: messages.reverse(),
        lastVisibleDoc: newLastVisibleDoc,
        hasMore: hasMore
      };
      return result;
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
      map(group => {
        const groupData = (group as GroupChat) || null;
        if (groupData) {
        } else {
        }
        return groupData;
      })
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
    const groupsCollectionRef = collection(this.firestore, 'groups');
    const q = query(
      groupsCollectionRef,
      where('members', 'array-contains', userId)
    );

    return collectionData(q, { idField: 'groupId' }).pipe(
      map(groups => {
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
    const currentUser = this.auth.currentUser;

    // ⭐ AGGIUNGI QUESTO CONTROLLO ⭐
    if (!currentUser) {
      console.error('GroupChatService: User not authenticated to add a member. Aborting.');
      throw new Error('User not authenticated.');
    }

    try {
      await updateDoc(groupDocRef, {
        members: arrayUnion(userIdToAdd)
      });

      const addedUserProfile: UserProfile | null = await this.userDataService.getUserDataById(userIdToAdd);
      const addedUserNickname = addedUserProfile?.nickname || addedUserProfile?.name || 'Un utente';

      // Ora currentUser non è più "probabilmente null"
      const currentUserProfile: UserProfile | null = await this.userDataService.getUserDataById(currentUser.uid);
      const currentUserNickname = currentUserProfile?.nickname || currentUserProfile?.name || 'Qualcuno';

      await this.sendMessage(groupId, 'system', `${currentUserNickname} ha aggiunto ${addedUserNickname} al gruppo.`, 'system');
    } catch (error) {
      console.error(`ERRORE nell'aggiungere il membro ${userIdToAdd} al gruppo ${groupId}:`, error);
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
    const currentUser = this.auth.currentUser;

    // ⭐ AGGIUNGI QUESTO CONTROLLO ⭐
    if (!currentUser) {
      console.error('GroupChatService: User not authenticated to remove a member. Aborting.');
      throw new Error('User not authenticated.');
    }

    try {
      await updateDoc(groupDocRef, {
        members: arrayRemove(userIdToRemove)
      });

      const removedUserProfile: UserProfile | null = await this.userDataService.getUserDataById(userIdToRemove);
      const removedUserNickname = removedUserProfile?.nickname || removedUserProfile?.name || 'Un utente';

      // Ora currentUser non è più "probabilmente null"
      const currentUserProfile: UserProfile | null = await this.userDataService.getUserDataById(currentUser.uid);
      const currentUserNickname = currentUserProfile?.nickname || currentUserProfile?.name || 'Qualcuno';

      await this.sendMessage(groupId, 'system', `${currentUserNickname} ha rimosso ${removedUserNickname} dal gruppo.`, 'system');
    } catch (error) {
      console.error(`ERRORE nel rimuovere il membro ${userIdToRemove} dal gruppo ${groupId}:`, error);
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
    // 1. Recupera il nickname dell'utente
    const leavingUserProfile: UserProfile | null = await this.userDataService.getUserDataById(userId);
    const leavingUserName = leavingUserProfile?.nickname || leavingUserProfile?.name || 'Un utente';

    // 2. INVIA IL MESSAGGIO DI SISTEMA PRIMA DI RIMOVERE L'UTENTE
    // ⭐ CORREZIONE: PASSA L'ID DELL'UTENTE ABBANDONATO IN UN ARRAY PER IL PARAMETRO 'mentions' ⭐
    await this.sendMessage(
      groupId,
      'system',
      `${leavingUserName} ha abbandonato il gruppo.`,
      'system',
      undefined,
      [userId], // ⭐ LA CORREZIONE È QUI: PASSiamo [userId] come array ⭐
      leavingUserName
    );

    // 3. Rimuovi l'utente dal documento del gruppo
    await updateDoc(groupDocRef, {
      members: arrayRemove(userId)
    });

    // 4. Elimina la sottocollezione del gruppo dall'utente
    await deleteDoc(userGroupDocRef);

  } catch (error) {
    console.error(`ERRORE nell'abbandonare il gruppo ${groupId} per l'utente ${userId}:`, error);
    console.error('Verifica le regole di sicurezza per:');
    console.error(`- Aggiornamento (update) di 'groups/${groupId}' (per arrayRemove)`);
    console.error(`- Eliminazione (delete) di 'users/${userId}/groups/${groupId}'`);
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
          map(members => {
            const validMembers = members.filter(Boolean) as UserProfile[];
            return validMembers;
          })
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
      console.error(`ERRORE nell'aggiornare i dettagli del gruppo ${groupId}:`, error);
      console.error('Verifica le regole di sicurezza per l\'aggiornamento (update) sul documento del gruppo.');
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
    const timestampToSet = timestamp || serverTimestamp() as Timestamp;

    try {
      await setDoc(userGroupDocRef, {
        lastReadMessageTimestamp: timestampToSet
      }, { merge: true });
    } catch (error: any) {
      console.error('ERRORE nel marcare i messaggi di gruppo come letti:', error);
      console.error('Verifica le regole di sicurezza per la scrittura (set/update) su `users/${userId}/groups/${groupId}`.');
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
      map(data => {
        const timestamp = (data ? (data['lastReadMessageTimestamp'] as Timestamp) || null : null);
        return timestamp;
      })
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
        // Non contare i messaggi di sistema o i messaggi inviati dall'utente stesso come "non letti"
        if (message.type !== 'system' && message.senderId !== userId) {
          unreadCount++;
        }
      });
      return unreadCount;
    } catch (error) {
      console.error(`ERRORE nel contare i messaggi non letti per il gruppo ${groupId} per l'utente ${userId}:`, error);
      console.error('Verifica le regole di sicurezza per la lettura su `groups/${groupId}/messages`.');
      return 0;
    }
  }

  // NUOVO METODO
  /**
   * Aggiunge più membri a un gruppo esistente.
   * @param groupId L'ID del gruppo.
   * @param userIdsToAdd Un array di ID degli utenti da aggiungere.
   * @returns Una Promise che risolve nel numero di membri aggiunti.
   */
  async addMembersToGroup(groupId: string, userIdsToAdd: string[]): Promise<number> {
    if (userIdsToAdd.length === 0) {
      console.warn('addMembersToGroup: Nessun membro da aggiungere.');
      return 0;
    }

    const groupDocRef = doc(this.firestore, 'groups', groupId);
    const currentUser = this.auth.currentUser;

    if (!currentUser) {
      console.error('GroupChatService: User not authenticated to add members. Aborting.');
      throw new Error('User not authenticated.');
    }

    try {
      await updateDoc(groupDocRef, {
        members: arrayUnion(...userIdsToAdd)
      });

      const addedMemberNicknames = await Promise.all(
        userIdsToAdd.map(async uid => {
          const userProfile = await this.userDataService.getUserDataById(uid);
          return userProfile?.nickname || userProfile?.name || 'Un utente';
        })
      );

      // ⭐ RECUPERA IL NICKNAME DELL'UTENTE CORRENTE IN MODO CORRETTO ⭐
      const currentUserProfile: UserProfile | null = await this.userDataService.getUserDataById(currentUser.uid);
      const currentUserNickname = currentUserProfile?.nickname || currentUserProfile?.name || 'Qualcuno';

      const newMemberNicknamesString = addedMemberNicknames.join(', ');

      const systemMessage = `${currentUserNickname} ha aggiunto ${newMemberNicknamesString} al gruppo.`;
      await this.sendMessage(groupId, 'system', systemMessage, 'system');

      return userIdsToAdd.length;
    } catch (error) {
      console.error(`ERRORE nell'aggiungere membri al gruppo ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Converte un file immagine in una stringa Base64.
   * @param file Il file dell'immagine.
   * @returns Una Promise che risolve nella stringa Base64 dell'immagine.
   */
  private convertFileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Converte un'immagine in Base64 e aggiorna l'URL nel documento del gruppo.
   * @param groupId L'ID del gruppo.
   * @param file Il file dell'immagine da caricare.
   */
  async updateGroupPhoto(groupId: string, file: File): Promise<void> {
    try {
      // 1. Converte il file in una stringa Base64
      const base64String = await this.convertFileToBase64(file);

      // 2. Aggiorna il documento del gruppo con la nuova stringa
      const updates: Partial<GroupChat> = { photoUrl: base64String };
      await this.updateGroupDetails(groupId, updates);

    } catch (error) {
      console.error('Errore nel caricamento della foto del gruppo:', error);
      throw error;
    }
  }

  /**
  * Elimina un array di messaggi specifici da una chat di gruppo.
  * Ogni eliminazione viene eseguita singolarmente: in caso di errore su un messaggio,
  * gli altri vengono comunque rimossi.
  * @param groupId L'ID del gruppo.
  * @param messageIds L'array di ID dei messaggi da eliminare.
  * @returns Una Promise che si risolve al completamento dell'operazione.
  */
  async deleteGroupMessages(groupId: string, messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) {
      console.warn("Nessun messaggio da eliminare.");
      return;
    }

    const messagesCollection = collection(this.firestore, `groups/${groupId}/messages`);
    const errors: string[] = [];

    for (const messageId of messageIds) {
      try {
        const messageDocRef = doc(messagesCollection, messageId);
        await deleteDoc(messageDocRef); // 🔹 eliminazione singola
      } catch (err) {
        console.error(`Errore nell'eliminazione del messaggio ${messageId}:`, err);
        errors.push(messageId);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Impossibile eliminare ${errors.length} messaggi: ${errors.join(", ")}`);
    }
  }

  // ⭐️ NUOVO METODO: ELIMINA UN INTERO GRUPPO ⭐️
  /**
   * Elimina un gruppo in modo permanente.
   * Verrà eliminato l'intero documento del gruppo e la sua sottocollezione di messaggi.
   * Solo il creatore del gruppo può eseguire questa azione.
   * @param groupId L'ID del gruppo da eliminare.
   */
  async deleteGroup(groupId: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      console.error('GroupChatService: User not authenticated to delete a group. Aborting.');
      throw new Error('User not authenticated.');
    }

    const groupDocRef = doc(this.firestore, 'groups', groupId);
    const messagesCollectionRef = collection(this.firestore, `groups/${groupId}/messages`);

    try {
      // 1. Recupera i dati del gruppo per la verifica dell'admin
      const groupDocSnapshot = await getDoc(groupDocRef);
      const groupData = groupDocSnapshot.data() as GroupChat;

      // 2. Verifica che l'utente corrente sia il creatore del gruppo
      if (!groupData || groupData.createdBy !== currentUser.uid) {
        throw new Error('Unauthorized: Only the group creator can delete the group.');
      }

      // 3. Esegui la cancellazione dei messaggi e del gruppo in un batch
      const batch = writeBatch(this.firestore);

      // Cerca e aggiungi tutti i messaggi del gruppo al batch di cancellazione
      const messagesQuerySnapshot = await getDocs(messagesCollectionRef);
      messagesQuerySnapshot.docs.forEach(messageDoc => {
        batch.delete(messageDoc.ref);
      });

      // Aggiungi il documento del gruppo al batch di cancellazione
      batch.delete(groupDocRef);

      // 4. Esegui il batch
      await batch.commit();

      console.log(`Gruppo e tutti i suoi messaggi eliminati con successo: ${groupId}`);

    } catch (error) {
      console.error(`ERRORE CRITICO nell'eliminare il gruppo ${groupId}:`, error);
      console.error('Assicurati che le regole di sicurezza di Firestore permettano le operazioni di lettura e cancellazione per questo utente.');
      throw error;
    }
  }


}
