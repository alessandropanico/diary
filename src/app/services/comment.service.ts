import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc, // Potrebbe non servire più, useremo setDoc con ID specifico
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  doc,
  deleteDoc,
  serverTimestamp, // Useremo ISOString()
  updateDoc,
  arrayUnion,
  arrayRemove,
  collectionData,
  startAfter,
  DocumentSnapshot,
  getDoc,
  QueryDocumentSnapshot,
  DocumentData,
  setDoc,
  // 👇 NOVITÀ: Importa increment per aggiornamenti atomici del contatore
  increment
} from '@angular/fire/firestore';
import { Observable, of, lastValueFrom, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

// --- INTERFACCE INCLUSE DIRETTAMENTE ---

/**
 * Interfaccia per un Commento nel database.
 * 'id' è l'ID del documento Firestore.
 * 'timestamp' è la data e ora di creazione.
 * 'likes' è un array di User ID che hanno messo "mi piace".
 * 'replies' è un array di commenti che sono risposte a questo commento.
 * 'isRootComment' indica se il commento è di primo livello (non una risposta).
 * 'parentId' è l'ID del commento genitore, se è una risposta.
 */
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userAvatarUrl: string;
  text: string;
  timestamp: string; // Useremo ISOString()
  likes: string[]; // Array di user IDs a cui piace
  replies?: Comment[]; // Opzionale, per i commenti annidati, può essere un array vuoto
  parentId: string | null; // ID del commento a cui si risponde, null se commento principale
  isRootComment?: boolean; // Aggiunto per chiarezza, opzionale per il modello dati
}

export interface CommentFetchResult {
  comments: Comment[];
  lastVisible: QueryDocumentSnapshot | null;
  hasMore: boolean;
}


// --- FINE INTERFACCE ---


@Injectable({
  providedIn: 'root'
})
export class CommentService {

  private _lastVisibleCommentDoc: QueryDocumentSnapshot | null = null;
  private firestore = inject(Firestore);

  constructor() { }

  resetPagination(): void {
    this._lastVisibleCommentDoc = null;
  }

  // --- NOVITÀ: Metodo per aggiornare il conteggio dei commenti sul post ---
  // Questo metodo è privato e chiamato internamente.
  private async updatePostCommentsCount(postId: string, change: number): Promise<void> {
    const postRef = doc(this.firestore, `posts`, postId);
    try {
      await updateDoc(postRef, {
        // Usa increment per aggiornamenti atomici
        // E Math.max per assicurarti che il conteggio non scenda sotto lo 0
        commentsCount: increment(change)
      });

      // Dopo l'incremento, recupera il valore attuale per assicurarti che non sia negativo
      const postSnap = await getDoc(postRef);
      const currentCount = postSnap.data()?.['commentsCount'] || 0;
      if (currentCount < 0) {
        await updateDoc(postRef, {
          commentsCount: 0 // Forza a 0 se è andato sotto
        });
        console.warn(`commentsCount for post ${postId} was negative (${currentCount}), reset to 0.`);
      }

      console.log(`commentsCount per post ${postId} aggiornato di ${change}`);
    } catch (error) {
      console.error(`Errore nell'aggiornare commentsCount per post ${postId}:`, error);
      // Non rilanciare l'errore per non bloccare l'operazione principale
    }
  }

  // --- NOVITÀ nel metodo addComment ---
  async addComment(
    commentData: Omit<Comment, 'id' | 'timestamp' | 'likes' | 'replies' | 'isRootComment'>
  ): Promise<string> {
    const commentsCollectionRef = collection(this.firestore, `posts/${commentData.postId}/comments`);
    const newCommentRef = doc(commentsCollectionRef);

    const commentToSave = {
      ...commentData,
      id: newCommentRef.id,
      timestamp: new Date().toISOString(), // Salvato come stringa ISO 8601
      likes: [],
      replies: [],
      isRootComment: commentData.parentId === null
    };

    console.log('addComment: Salvando il commento con timestamp:', commentToSave.timestamp);
    console.log('addComment: Tipo di timestamp salvato:', typeof commentToSave.timestamp);

    try {
      await setDoc(newCommentRef, commentToSave);
      // 👇 NOVITÀ: Incrementa il conteggio dei commenti del post
      await this.updatePostCommentsCount(commentData.postId, 1);
      return newCommentRef.id;
    } catch (error) {
      console.error('Errore durante l\'aggiunta del commento:', error);
      throw new Error('Impossibile aggiungere il commento.');
    }
  }

  /**
   * Helper per convertire il timestamp (che può essere Firestore.Timestamp o stringa)
   * in una stringa ISO 8601.
   */
  private convertTimestampToISOString(timestamp: any): string {
    console.log('convertTimestampToISOString: Input timestamp:', timestamp);
    console.log('convertTimestampToISOString: Tipo input timestamp:', typeof timestamp);

    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      console.log('convertTimestampToISOString: Rilevato Firestore Timestamp, convertendo...');
      return timestamp.toDate().toISOString();
    }
    console.log('convertTimestampToISOString: Timestamp è già stringa o non è Firestore Timestamp. Valore:', timestamp);
    return timestamp || new Date().toISOString();
  }

  getCommentsForPost(postId: string, commentsLimit: number = 10): Observable<Comment[]> {
    const commentsCollectionRef = collection(this.firestore, `posts/${postId}/comments`);

    const commentsQuery = query(
      commentsCollectionRef,
      where('parentId', '==', null),
      orderBy('timestamp', 'desc'),
      limit(commentsLimit)
    );

    return collectionData(commentsQuery, { idField: 'id' }).pipe(
      map(docs => docs.map(docData => {
        const comment = docData as Comment;
        console.log('getCommentsForPost (map): Commento grezzo:', docData);
        comment.timestamp = this.convertTimestampToISOString(comment.timestamp);
        comment.replies = comment.replies || [];
        comment.isRootComment = comment.parentId === null;
        return comment;
      })),
      switchMap(async (rootComments) => {
        const commentsWithReplies = await Promise.all(
          rootComments.map(async (comment) => {
            const replies = await lastValueFrom(this.getRepliesForCommentOnce(postId, comment.id));
            comment.replies = replies ? replies.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : [];
            return comment;
          })
        );
        return commentsWithReplies;
      })
    );
  }

  getRepliesForComment(postId: string, parentCommentId: string): Observable<Comment[]> {
    if (!parentCommentId) {
      return of([]);
    }
    const repliesCollectionRef = collection(this.firestore, `posts/${postId}/comments`);
    const repliesQuery = query(
      repliesCollectionRef,
      where('parentId', '==', parentCommentId),
      orderBy('timestamp', 'asc')
    );

    return collectionData(repliesQuery, { idField: 'id' }).pipe(
      map(docs => docs.map(docData => {
        const reply = docData as Comment;
        console.log('getRepliesForComment (map): Risposta grezza:', docData);
        reply.timestamp = this.convertTimestampToISOString(reply.timestamp);
        reply.isRootComment = false;
        return reply;
      }))
    );
  }

  getRepliesForCommentOnce(postId: string, parentCommentId: string): Observable<Comment[]> {
    if (!parentCommentId) {
      return of([]);
    }
    const repliesCollectionRef = collection(this.firestore, `posts/${postId}/comments`);
    const repliesQuery = query(
      repliesCollectionRef,
      where('parentId', '==', parentCommentId),
      orderBy('timestamp', 'asc')
    );

    return from(getDocs(repliesQuery)).pipe(
      map(querySnapshot => {
        const replies: Comment[] = [];
        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          console.log('getRepliesForCommentOnce (forEach): Dati documento risposte:', data);
          console.log('getRepliesForCommentOnce (forEach): Timestamp originale (prima conversione):', data['timestamp']);
          console.log('getRepliesForCommentOnce (forEach): Tipo timestamp originale (prima conversione):', typeof data['timestamp']);
          replies.push({
            id: docSnap.id,
            postId: postId,
            userId: data['userId'],
            username: data['username'],
            userAvatarUrl: data['userAvatarUrl'],
            text: data['text'],
            timestamp: this.convertTimestampToISOString(data['timestamp']), // La riga incriminata
            likes: data['likes'] || [],
            parentId: data['parentId'] || null,
            isRootComment: false
          } as Comment);
        });
        return replies;
      })
    );
  }

  async getCommentsForPostOnce(postId: string, commentsLimit: number = 10): Promise<CommentFetchResult> {
    const commentsCollectionRef = collection(this.firestore, `posts/${postId}/comments`);

    let commentsQuery = query(
      commentsCollectionRef,
      where('parentId', '==', null),
      orderBy('timestamp', 'desc'),
      limit(commentsLimit + 1)
    );

    if (this._lastVisibleCommentDoc) {
      commentsQuery = query(commentsQuery, startAfter(this._lastVisibleCommentDoc));
    }

    const querySnapshot = await getDocs(commentsQuery);
    const comments: Comment[] = [];
    let hasMore = false;

    this._lastVisibleCommentDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] as QueryDocumentSnapshot : null;

    if (querySnapshot.docs.length > commentsLimit) {
      hasMore = true;
    }

    querySnapshot.docs.slice(0, commentsLimit).forEach(docSnap => {
      const data = docSnap.data();
      console.log('getCommentsForPostOnce (forEach): Dati documento commenti principali:', data);
      console.log('getCommentsForPostOnce (forEach): Timestamp originale (prima conversione):', data['timestamp']);
      console.log('getCommentsForPostOnce (forEach): Tipo timestamp originale (prima conversione):', typeof data['timestamp']);
      comments.push({
        id: docSnap.id,
        postId: postId,
        userId: data['userId'],
        username: data['username'],
        userAvatarUrl: data['userAvatarUrl'],
        text: data['text'],
        timestamp: this.convertTimestampToISOString(data['timestamp']),
        likes: data['likes'] || [],
        parentId: data['parentId'] || null,
        replies: [],
        isRootComment: data['parentId'] === null
      } as Comment);
    });

    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await lastValueFrom(this.getRepliesForCommentOnce(postId, comment.id));
        comment.replies = replies ? replies.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : [];
        return comment;
      })
    );

    return { comments: commentsWithReplies, hasMore: hasMore, lastVisible: this._lastVisibleCommentDoc };
  }

  async getCommentByIdOnce(postId: string, commentId: string): Promise<Comment | null> {
    const commentDocRef = doc(this.firestore, `posts/${postId}/comments`, commentId);
    const docSnap = await getDoc(commentDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('getCommentByIdOnce: Dati documento singolo commento:', data);
      console.log('getCommentByIdOnce: Timestamp originale (prima conversione):', data['timestamp']);
      console.log('getCommentByIdOnce: Tipo timestamp originale (prima conversione):', typeof data['timestamp']);
      return {
        id: docSnap.id,
        postId: postId,
        userId: data['userId'],
        username: data['username'],
        userAvatarUrl: data['userAvatarUrl'],
        text: data['text'],
        timestamp: this.convertTimestampToISOString(data['timestamp']),
        likes: data['likes'] || [],
        parentId: data['parentId'] || null,
        replies: [],
        isRootComment: data['parentId'] === null
      } as Comment;
    } else {
      return null;
    }
  }

  // --- NOVITÀ nel metodo deleteCommentAndReplies ---
  async deleteCommentAndReplies(postId: string, commentId: string): Promise<void> {
    console.log('deleteCommentAndReplies: Tentativo di eliminare commento principale e risposte. Post ID:', postId, 'Comment ID:', commentId);
    const commentDocRef = doc(this.firestore, `posts/${postId}/comments`, commentId);
    const docSnap = await getDoc(commentDocRef);

    if (!docSnap.exists()) {
      console.error('deleteCommentAndReplies: Commento principale non trovato per ID:', commentId);
      throw new Error('Commento non trovato: impossibile eliminare.');
    }

    const commentData = docSnap.data();
    if (commentData?.['parentId'] !== null) {
      console.error('deleteCommentAndReplies: Tentativo di eliminare una risposta come commento principale. Comment ID:', commentId, 'Parent ID:', commentData?.['parentId']);
      throw new Error('Questo metodo è destinato all\'eliminazione di commenti principali con risposte a cascata. Usa deleteSingleComment per eliminare risposte.');
    }

    const commentsToDeleteIds: string[] = [];
    // Raccogli anche l'ID del commento principale per il conteggio totale
    commentsToDeleteIds.push(commentId);
    await this._collectRepliesToDelete(postId, commentId, commentsToDeleteIds);
    console.log('deleteCommentAndReplies: Trovate risposte annidate da eliminare, incluso il principale:', commentsToDeleteIds);

    const batch = writeBatch(this.firestore);
    commentsToDeleteIds.forEach(id => {
      const deleteRef = doc(this.firestore, `posts/${postId}/comments`, id);
      batch.delete(deleteRef);
      console.log('deleteCommentAndReplies: Aggiunto al batch di eliminazione:', id);
    });

    await batch.commit();
    console.log('deleteCommentAndReplies: Batch di eliminazione completato con successo.');

    // 👇 NOVITÀ: Decrementa il conteggio totale dei commenti sul post
    // Il cambiamento è il numero totale di commenti (e risposte) che sono stati eliminati
    await this.updatePostCommentsCount(postId, -commentsToDeleteIds.length);
  }

  // --- NOVITÀ nel metodo deleteSingleComment ---
  async deleteSingleComment(postId: string, commentId: string): Promise<void> {
    console.log('deleteSingleComment: Tentativo di eliminare singolo commento/risposta. Post ID:', postId, 'Comment ID:', commentId);
    const commentDocRef = doc(this.firestore, `posts/${postId}/comments`, commentId);
    const docSnap = await getDoc(commentDocRef);

    if (!docSnap.exists()) {
      console.error('deleteSingleComment: Commento/risposta non trovato per ID:', commentId);
      throw new Error('Commento non trovato: impossibile eliminare.');
    }

    await deleteDoc(commentDocRef);
    console.log('deleteSingleComment: Commento/risposta eliminato con successo:', commentId);

    // 👇 NOVITÀ: Decrementa il conteggio dei commenti del post di 1
    await this.updatePostCommentsCount(postId, -1);
  }

  async toggleLikeComment(postId: string, commentId: string, userId: string, liked: boolean): Promise<void> {
    console.log('toggleLikeComment: Toggling like. Post ID:', postId, 'Comment ID:', commentId, 'User ID:', userId, 'Liked:', liked);
    const commentDocRef = doc(this.firestore, `posts/${postId}/comments`, commentId);
    if (liked) {
      await updateDoc(commentDocRef, {
        likes: arrayUnion(userId)
      });
      console.log('toggleLikeComment: Aggiunto like per utente:', userId, 'su commento:', commentId);
    } else {
      await updateDoc(commentDocRef, {
        likes: arrayRemove(userId)
      });
      console.log('toggleLikeComment: Rimosso like per utente:', userId, 'da commento:', commentId);
    }
    console.log('toggleLikeComment: Operazione completata.');
  }

  private async _collectRepliesToDelete(postId: string, parentCommentId: string, ids: string[]): Promise<void> {
    console.log('_collectRepliesToDelete: Inizio raccolta risposte per parent ID:', parentCommentId);
    const commentsCollectionRef = collection(this.firestore, `posts/${postId}/comments`);
    let queue = [parentCommentId];
    let visited = new Set<string>();

    while (queue.length > 0) {
      const currentParentId = queue.shift() as string;
      console.log('_collectRepliesToDelete: Processando parent ID:', currentParentId);
      const repliesQuery = query(commentsCollectionRef, where('parentId', '==', currentParentId));
      const repliesSnapshot = await getDocs(repliesQuery);

      repliesSnapshot.forEach(docSnap => {
        if (!visited.has(docSnap.id)) {
          ids.push(docSnap.id);
          queue.push(docSnap.id);
          visited.add(docSnap.id);
          console.log('_collectRepliesToDelete: Trovata risposta discendente:', docSnap.id);
        }
      });
    }
    console.log('_collectRepliesToDelete: Raccolta completata. IDs totali:', ids);
  }
}
