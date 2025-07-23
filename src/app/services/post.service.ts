// src/app/services/post.service.ts
import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  arrayUnion,
  arrayRemove
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Post } from '../interfaces/post';

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private postsCollection = collection(this.firestore, 'posts');

  constructor(private firestore: Firestore) { }

  /**
   * Crea un nuovo post.
   * @param post Il post da salvare (senza id, verrà generato da Firestore).
   * @returns Promise<void>
   */
  async createPost(post: Omit<Post, 'id' | 'likes' | 'commentsCount'>): Promise<void> {
    const newPostData = {
      ...post,
      timestamp: new Date().toISOString(), // Aggiunge il timestamp al momento della creazione
      likes: [], // Inizializza i mi piace come array vuoto
      commentsCount: 0 // Inizializza il conteggio commenti a 0
    };
    await addDoc(this.postsCollection, newPostData);
  }

  /**
   * Recupera un numero limitato di post, ordinati per data di creazione.
   * @param count Il numero di post da recuperare (default 20).
   * @returns Observable<Post[]> Un observable di array di post.
   */
  getPosts(count: number = 20): Observable<Post[]> {
    const q = query(this.postsCollection, orderBy('timestamp', 'desc'), limit(count));
    return collectionData(q, { idField: 'id' }) as Observable<Post[]>;
  }

  /**
   * Ottiene un singolo post per ID.
   * @param postId L'ID del post.
   * @returns Promise<Post | undefined>
   */
  async getPostById(postId: string): Promise<Post | undefined> {
    const postRef = doc(this.firestore, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
      return { id: postSnap.id, ...postSnap.data() } as Post;
    }
    return undefined;
  }

  /**
   * Aggiorna un post esistente.
   * @param postId L'ID del post da aggiornare.
   * @param updates Gli aggiornamenti da applicare al post.
   * @returns Promise<void>
   */
  async updatePost(postId: string, updates: Partial<Post>): Promise<void> {
    const postRef = doc(this.firestore, 'posts', postId);
    await updateDoc(postRef, updates);
  }

  /**
   * Elimina un post.
   * @param postId L'ID del post da eliminare.
   * @returns Promise<void>
   */
  async deletePost(postId: string): Promise<void> {
    const postRef = doc(this.firestore, 'posts', postId);
    await deleteDoc(postRef);
  }

  /**
   * Gestisce il "mi piace" o "non mi piace" di un post.
   * @param postId L'ID del post.
   * @param userId L'ID dell'utente che sta mettendo/togliendo il mi piace.
   * @param liked True per mettere mi piace, false per togliere.
   * @returns Promise<void>
   */
  async toggleLike(postId: string, userId: string, liked: boolean): Promise<void> {
    const postRef = doc(this.firestore, 'posts', postId);
    if (liked) {
      await updateDoc(postRef, {
        likes: arrayUnion(userId)
      });
    } else {
      await updateDoc(postRef, {
        likes: arrayRemove(userId)
      });
    }
  }

  // Metodo per incrementare il conteggio dei commenti (se gestisci i commenti come sub-collection)
  async incrementCommentCount(postId: string): Promise<void> {
    const postRef = doc(this.firestore, 'posts', postId);
    // Nota: Firestore non ha un operatore per incrementare direttamente come in Realtime DB per i numeri
    // dovresti recuperare il post, aggiornare il count e poi salvarlo, oppure usare una transaction.
    // Per ora, useremo un approccio semplificato.
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
        const currentComments = postSnap.data()['commentsCount'] || 0;
        await updateDoc(postRef, { commentsCount: currentComments + 1 });
    }
  }

  // Metodo per decrementare il conteggio dei commenti
  async decrementCommentCount(postId: string): Promise<void> {
    const postRef = doc(this.firestore, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
        const currentComments = postSnap.data()['commentsCount'] || 0;
        if (currentComments > 0) {
            await updateDoc(postRef, { commentsCount: currentComments - 1 });
        }
    }
  }
}
