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
  updateDoc, // AGGIUNTO per updateDoc
  arrayUnion, // AGGIUNTO per arrayUnion
  arrayRemove, // AGGIUNTO per arrayRemove
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Comment } from '../interfaces/comment';

@Injectable({
  providedIn: 'root'
})
export class CommentService {

  constructor(private firestore: Firestore) { }

  /**
   * Aggiunge un nuovo commento a un post specifico.
   */
  async addComment(comment: Omit<Comment, 'id' | 'timestamp' | 'likes'>): Promise<string> {
    const commentsCollection = collection(this.firestore, `posts/${comment.postId}/comments`);
    const docRef = await addDoc(commentsCollection, {
      ...comment,
      timestamp: serverTimestamp(),
      likes: [] // Inizializza l'array dei like vuoto
    });
    return docRef.id;
  }

  /**
   * Ottiene i commenti per un post specifico, con paginazione.
   */
  getCommentsForPost(postId: string, commentsLimit: number = 10, lastCommentTimestamp: string | null = null): Observable<Comment[]> {
    const commentsCollectionRef = collection(this.firestore, `posts/${postId}/comments`);

    let commentsQuery = query(
      commentsCollectionRef,
      orderBy('timestamp', 'desc'),
      limit(commentsLimit)
    );

    // Come discusso, per startAfter con serverTimestamp, avresti bisogno di un DocumentSnapshot.
    // Per un'implementazione completa e robusta, si raccomanda di passare l'ultimo docSnapshot
    // piuttosto che solo il timestamp, o usare una Cloud Function per la paginazione.
    // Per semplicità qui, la paginazione basata su timestamp è abbozzata ma potrebbe non essere perfetta con serverTimestamp.

    return from(getDocs(commentsQuery)).pipe(
      map(querySnapshot => {
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
            timestamp: (data['timestamp']?.toDate() || new Date()).toISOString(), // Converti Timestamp a string ISO
            likes: data['likes'] || [], // Leggi l'array dei like, default a vuoto se non esiste
          });
        });
        return comments;
      })
    );
  }

  /**
   * Elimina un commento.
   */
  async deleteComment(postId: string, commentId: string): Promise<void> {
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

  // La funzione updateCommentCount non è direttamente influenzata dai like ai commenti,
  // ma rimane la raccomandazione di gestirla via Cloud Functions per affidabilità.
  // async updateCommentCount(postId: string, incrementBy: number): Promise<void> { /* ... */ }
}
