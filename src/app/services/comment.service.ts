import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collectionData,
  startAfter,
  DocumentSnapshot
} from '@angular/fire/firestore';
import { Observable, of, lastValueFrom } from 'rxjs'; // Aggiunto 'lastValueFrom' e 'of'
import { map, switchMap } from 'rxjs/operators'; // 'finalize' non è più necessario qui

import { Comment } from '../interfaces/comment';

@Injectable({
  providedIn: 'root'
})
export class CommentService {

  constructor(private firestore: Firestore) { }

  /**
   * Aggiunge un nuovo commento (o una risposta) a un post specifico.
   * @param comment Il commento da aggiungere, con opzionale parentId.
   */
  async addComment(comment: Omit<Comment, 'id' | 'timestamp' | 'likes' | 'replies'>): Promise<string> {
    const commentsCollection = collection(this.firestore, `posts/${comment.postId}/comments`);
    const docRef = await addDoc(commentsCollection, {
      ...comment,
      timestamp: serverTimestamp(),
      likes: [], // Inizializza l'array dei like vuoto
      parentId: comment.parentId || null // Salva parentId su Firestore, null se di primo livello
    });
    return docRef.id;
  }

  /**
   * Ottiene i commenti di PRIMO LIVELLO per un post specifico in tempo reale.
   * Questo metodo usa una sottoscrizione per aggiornamenti immediati.
   * Successivamente caricheremo le risposte per ciascun commento.
   * @param postId L'ID del post per cui recuperare i commenti.
   * @param commentsLimit Il numero massimo di commenti di primo livello da caricare inizialmente.
   */
  getCommentsForPost(postId: string, commentsLimit: number = 10): Observable<Comment[]> {
    const commentsCollectionRef = collection(this.firestore, `posts/${postId}/comments`);

    let commentsQuery = query(
      commentsCollectionRef,
      where('parentId', '==', null), // Filtra solo i commenti di primo livello
      orderBy('timestamp', 'desc'),
      limit(commentsLimit)
    );

    return collectionData(commentsQuery, { idField: 'id' }).pipe(
      // Prima mappiamo i commenti di primo livello e inizializziamo l'array delle risposte
      map(docs => docs.map(doc => {
        const comment = doc as Comment;
        if (comment.timestamp && typeof comment.timestamp === 'object' && 'toDate' in (comment.timestamp as any)) {
          comment.timestamp = (comment.timestamp as any).toDate().toISOString();
        }
        comment.replies = []; // Inizializza l'array delle risposte qui per garantire che sia sempre un array
        return comment;
      })),
      // Poi, per ogni commento di primo livello, recuperiamo e popoliamo le sue risposte
      switchMap(async (rootComments) => {
        const commentsWithReplies = await Promise.all(
          rootComments.map(async (comment) => {
            // Usa lastValueFrom per convertire l'Observable in una Promise
            const replies = await lastValueFrom(this.getRepliesForCommentOnce(postId, comment.id));
            // Assicurati che 'replies' sia un array prima di ordinarlo, altrimenti usa un array vuoto
            comment.replies = replies ? replies.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : [];
            return comment;
          })
        );
        return commentsWithReplies;
      })
    );
  }

  /**
   * Ottiene le risposte per un commento specifico in tempo reale.
   * @param postId L'ID del post.
   * @param parentCommentId L'ID del commento genitore.
   */
  getRepliesForComment(postId: string, parentCommentId: string): Observable<Comment[]> {
    if (!parentCommentId) {
      return of([]); // Se non c'è parentId, non ci sono risposte dirette a un non-commento
    }
    const repliesCollectionRef = collection(this.firestore, `posts/${postId}/comments`);
    const repliesQuery = query(
      repliesCollectionRef,
      where('parentId', '==', parentCommentId), // Filtra per parentId
      orderBy('timestamp', 'asc') // Le risposte sono spesso ordinate per le più vecchie prima
    );

    return collectionData(repliesQuery, { idField: 'id' }).pipe(
      map(docs => docs.map(doc => {
        const reply = doc as Comment;
        if (reply.timestamp && typeof reply.timestamp === 'object' && 'toDate' in (reply.timestamp as any)) {
          reply.timestamp = (reply.timestamp as any).toDate().toISOString();
        }
        return reply;
      }))
    );
  }

  /**
   * Ottiene le risposte per un commento specifico una tantum (per Promise/Async-await).
   * Utile quando si caricano i commenti di primo livello e si vogliono aggregare subito le risposte.
   * @param postId L'ID del post.
   * @param parentCommentId L'ID del commento genitore.
   */
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

    // Crea un Observable che emette il risultato di getDocs una volta e poi si completa
    return new Observable<Comment[]>(observer => {
      getDocs(repliesQuery).then(querySnapshot => {
        const replies: Comment[] = [];
        querySnapshot.forEach(doc => {
          const data = doc.data();
          replies.push({
            id: doc.id,
            postId: postId,
            userId: data['userId'],
            username: data['username'],
            userAvatarUrl: data['userAvatarUrl'],
            text: data['text'],
            timestamp: (data['timestamp']?.toDate() || new Date()).toISOString(),
            likes: data['likes'] || [],
            parentId: data['parentId'] || null
          });
        });
        observer.next(replies);
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Ottiene un blocco di commenti di PRIMO LIVELLO una tantum (non in tempo reale),
   * utile per la paginazione "carica di più".
   * @param postId L'ID del post.
   * @param commentsLimit Il numero di commenti di primo livello da caricare.
   * @param lastVisibleDocSnapshot L'ultimo DocumentSnapshot caricato per la paginazione.
   */
  async getCommentsForPostOnce(postId: string, commentsLimit: number = 10, lastVisibleDocSnapshot: DocumentSnapshot | null = null): Promise<{ comments: Comment[], lastDoc: DocumentSnapshot | null }> {
    const commentsCollectionRef = collection(this.firestore, `posts/${postId}/comments`);

    let commentsQuery = query(
      commentsCollectionRef,
      where('parentId', '==', null), // Filtra solo i commenti di primo livello
      orderBy('timestamp', 'desc'),
      limit(commentsLimit)
    );

    if (lastVisibleDocSnapshot) {
      commentsQuery = query(commentsQuery, startAfter(lastVisibleDocSnapshot));
    }

    const querySnapshot = await getDocs(commentsQuery);
    const comments: Comment[] = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      comments.push({
        id: doc.id,
        postId: postId,
        userId: data['userId'],
        username: data['username'],
        userAvatarUrl: data['userAvatarUrl'],
        text: data['text'],
        timestamp: (data['timestamp']?.toDate() || new Date()).toISOString(),
        likes: data['likes'] || [],
        parentId: data['parentId'] || null, // Assicurati di includere parentId
        replies: [] // Inizializza l'array replies qui per garantire che sia sempre un array
      });
    });

    const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

    // Recupera le risposte per i commenti appena caricati
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        // Usa lastValueFrom per convertire l'Observable in una Promise
        const replies = await lastValueFrom(this.getRepliesForCommentOnce(postId, comment.id));
        // Assicurati che 'replies' sia un array prima di ordinarlo, altrimenti usa un array vuoto
        comment.replies = replies ? replies.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : [];
        return comment;
      })
    );

    return { comments: commentsWithReplies, lastDoc: lastDoc };
  }

  /**
   * Elimina un commento. Impedisce l'eliminazione se il commento contiene risposte.
   * @param postId L'ID del post proprietario del commento.
   * @param commentId L'ID del commento da eliminare.
   */
  async deleteComment(postId: string, commentId: string): Promise<void> {
    // Verifica se il commento ha risposte
    const repliesQuery = query(
      collection(this.firestore, `posts/${postId}/comments`),
      where('parentId', '==', commentId),
      limit(1) // Basta trovare anche solo una risposta
    );
    const repliesSnapshot = await getDocs(repliesQuery);

    if (!repliesSnapshot.empty) {
      throw new Error('Impossibile eliminare il commento: contiene risposte.');
    }

    const commentDocRef = doc(this.firestore, `posts/${postId}/comments`, commentId);
    await deleteDoc(commentDocRef);
  }

  /**
   * Gestisce l'aggiunta/rimozione di un "Mi piace" a un commento.
   * @param postId L'ID del post proprietario del commento.
   * @param commentId L'ID del commento da modificare.
   * @param userId L'ID dell'utente che sta mettendo/togliendo il "Mi piace".
   * @param liked Indica se l'utente vuole mettere (true) o togliere (false) il "Mi piace".
   */
  async toggleLikeComment(postId: string, commentId: string, userId: string, liked: boolean): Promise<void> {
    const commentDocRef = doc(this.firestore, `posts/${postId}/comments`, commentId);
    if (liked) {
      await updateDoc(commentDocRef, {
        likes: arrayUnion(userId) // Aggiunge l'ID utente all'array se non già presente
      });
    } else {
      await updateDoc(commentDocRef, {
        likes: arrayRemove(userId) // Rimuove l'ID utente dall'array
      });
    }
  }
}
