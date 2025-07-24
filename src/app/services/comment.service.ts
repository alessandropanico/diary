import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,       // Re-importato per getCommentsForPostOnce
  doc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,      // Mantenuto per la reattività
  collectionData,  // Utilizzato per creare l'Observable reattivo
  startAfter,      // Aggiunto per la paginazione
  DocumentSnapshot // Aggiunto per la paginazione più robusta
} from '@angular/fire/firestore';
import { Observable } from 'rxjs'; // 'from' non è più necessario qui
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
   * Ottiene i commenti per un post specifico in tempo reale.
   * Questo metodo usa una sottoscrizione per aggiornamenti immediati.
   * @param postId L'ID del post per cui recuperare i commenti.
   * @param commentsLimit Il numero massimo di commenti da caricare inizialmente.
   */
  getCommentsForPost(postId: string, commentsLimit: number = 10): Observable<Comment[]> {
    const commentsCollectionRef = collection(this.firestore, `posts/${postId}/comments`);

    let commentsQuery = query(
      commentsCollectionRef,
      orderBy('timestamp', 'desc'),
      limit(commentsLimit) // Limita i primi N commenti per l'osservatore reattivo
    );

    // Utilizza collectionData da @angular/fire per un Observable reattivo
    return collectionData(commentsQuery, { idField: 'id' }).pipe(
      map(docs => {
        // Mappa i dati per convertire il Timestamp di Firestore in stringa ISO
        return docs.map(doc => {
          const comment = doc as Comment;
          // Assicurati che timestamp sia convertito se è un oggetto Timestamp
          if (comment.timestamp && typeof comment.timestamp === 'object' && 'toDate' in (comment.timestamp as any)) {
            comment.timestamp = (comment.timestamp as any).toDate().toISOString();
          }
          return comment;
        });
      })
    );
  }

  /**
   * Ottiene un blocco di commenti per un post specifico una tantum (non in tempo reale),
   * utile per la paginazione "carica di più".
   * @param postId L'ID del post.
   * @param commentsLimit Il numero di commenti da caricare.
   * @param lastVisibleDocSnapshot L'ultimo DocumentSnapshot caricato per la paginazione.
   */
  async getCommentsForPostOnce(postId: string, commentsLimit: number = 10, lastVisibleDocSnapshot: DocumentSnapshot | null = null): Promise<Comment[]> {
    const commentsCollectionRef = collection(this.firestore, `posts/${postId}/comments`);

    let commentsQuery = query(
      commentsCollectionRef,
      orderBy('timestamp', 'desc'),
      limit(commentsLimit)
    );

    if (lastVisibleDocSnapshot) {
      // Se è presente un DocumentSnapshot, riprendi da lì
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
        // Converti Timestamp a string ISO. getDocs restituisce sempre Timestamp per i campi Timestamp.
        timestamp: (data['timestamp']?.toDate() || new Date()).toISOString(),
        likes: data['likes'] || [],
      });
    });
    return comments;
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
