import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, getDoc, startAfter, where } from '@angular/fire/firestore'; // IMPORTANTE: assicurati che 'where' sia qui
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
        likes: [],
        commentsCount: 0
      });
      return docRef.id;
    } catch (error) {
      console.error('Errore durante la creazione del post:', error);
      throw error;
    }
  }

  getPosts(limitPosts: number = 10, startAfterTimestamp: string | null = null): Observable<Post[]> {
    return from(this.getPostsQuery(limitPosts, startAfterTimestamp)).pipe(
      map(querySnapshot => {
        const posts: Post[] = [];
        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          posts.push({
            id: docSnap.id,
            ...data as Omit<Post, 'id'>,
            commentsCount: Math.max(0, data['commentsCount'] || 0)
          });
        });
        return posts;
      }),
      catchError(error => {
        console.error('Errore nel recupero dei post:', error);
        return of([]);
      })
    );
  }

  private async getPostsQuery(limitPosts: number, startAfterTimestamp: string | null) {
    let q;
    if (startAfterTimestamp) {
      q = query(
        this.postsCollection,
        orderBy('timestamp', 'desc'),
        startAfter(startAfterTimestamp),
        limit(limitPosts)
      );
    } else {
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
      return;
    }

    try {
      await updateDoc(postRef, { likes: updatedLikes });
    } catch (error) {
      console.error('Errore nel toggle like:', error);
      throw error;
    }
  }


  getUserPosts(userId: string, limitPosts: number = 10, startAfterTimestamp: string | null = null): Observable<Post[]> {
    return from(this.getUserPostsQuery(userId, limitPosts, startAfterTimestamp)).pipe(
      map(querySnapshot => {
        const posts: Post[] = [];
        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          posts.push({
            id: docSnap.id,
            ...data as Omit<Post, 'id'>,
            commentsCount: Math.max(0, data['commentsCount'] || 0)
          });
        });
        return posts;
      }),
      catchError(error => {
        console.error(`Errore nel recupero dei post per l'utente ${userId}:`, error);
        return of([]);
      })
    );
  }

  private async getUserPostsQuery(userId: string, limitPosts: number, startAfterTimestamp: string | null) {
    let q;
    if (startAfterTimestamp) {
      q = query(
        this.postsCollection,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        startAfter(startAfterTimestamp),
        limit(limitPosts)
      );
    } else {
      q = query(
        this.postsCollection,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitPosts)
      );
    }
    return getDocs(q);
  }


}
