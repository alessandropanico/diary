// src/app/services/post.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, getDoc, startAfter } from '@angular/fire/firestore'; // AGGIUNTO startAfter
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Post } from '../interfaces/post';

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private postsCollection = collection(this.firestore, 'posts');

  constructor(private firestore: Firestore) { }

  async createPost(post: Omit<Post, 'id' | 'likes' | 'commentsCount'>): Promise<string> {
    try {
      const docRef = await addDoc(this.postsCollection, {
        ...post,
        likes: [], // Inizializza i "mi piace" come un array vuoto
        commentsCount: 0 // Inizializza il conteggio commenti a 0
      });
      return docRef.id;
    } catch (error) {
      console.error('Errore durante la creazione del post:', error);
      throw error;
    }
  }

  // MODIFICATO: getPosts accetta limite e un timestamp da cui iniziare
  getPosts(limitPosts: number = 10, startAfterTimestamp: string | null = null): Observable<Post[]> {
    return from(this.getPostsQuery(limitPosts, startAfterTimestamp)).pipe(
      map(querySnapshot => {
        const posts: Post[] = [];
        querySnapshot.forEach(doc => {
          posts.push({ id: doc.id, ...doc.data() as Omit<Post, 'id'> });
        });
        return posts;
      }),
      catchError(error => {
        console.error('Errore nel recupero dei post:', error);
        return of([]); // Restituisce un array vuoto in caso di errore
      })
    );
  }

  private async getPostsQuery(limitPosts: number, startAfterTimestamp: string | null) {
    let q;
    if (startAfterTimestamp) {
      // Se startAfterTimestamp è fornito, inizia a leggere da lì (per la paginazione)
      q = query(
        this.postsCollection,
        orderBy('timestamp', 'desc'), // Ordina dal più recente al più vecchio
        startAfter(startAfterTimestamp), // Inizia dopo questo timestamp
        limit(limitPosts)
      );
    } else {
      // Altrimenti, prendi i primi N post
      q = query(
        this.postsCollection,
        orderBy('timestamp', 'desc'),
        limit(limitPosts)
      );
    }
    return getDocs(q);
  }

  async deletePost(postId: string): Promise<void> {
    const postDoc = doc(this.firestore, 'posts', postId);
    try {
      await deleteDoc(postDoc);
    } catch (error) {
      console.error('Errore durante l\'eliminazione del post:', error);
      throw error;
    }
  }

  async toggleLike(postId: string, userId: string, like: boolean): Promise<void> {
    const postRef = doc(this.firestore, 'posts', postId);
    const postDoc = await getDoc(postRef);

    if (!postDoc.exists()) {
      throw new Error('Post non trovato.');
    }

    const currentLikes: string[] = postDoc.data()?.['likes'] || [];
    let updatedLikes: string[];

    if (like && !currentLikes.includes(userId)) {
      updatedLikes = [...currentLikes, userId];
    } else if (!like && currentLikes.includes(userId)) {
      updatedLikes = currentLikes.filter(id => id !== userId);
    } else {
      // Nessun cambiamento necessario
      return;
    }

    try {
      await updateDoc(postRef, { likes: updatedLikes });
    } catch (error) {
      console.error('Errore nel toggle like:', error);
      throw error;
    }
  }
}
