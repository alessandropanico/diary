// src/app/services/post.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, getDoc, startAfter, where } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Post } from '../interfaces/post';
import { UserDataService } from './user-data.service';
import { getAuth } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private postsCollection = collection(this.firestore, 'posts');

  constructor(
    private firestore: Firestore,
    private userDataService: UserDataService
  ) { }

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

  // ⭐⭐⭐ NUOVO METODO AGGIUNTO QUI ⭐⭐⭐
  getPostById(postId: string): Observable<Post | null> {
    const postDocRef = doc(this.firestore, 'posts', postId);
    return from(getDoc(postDocRef)).pipe(
      map(docSnapshot => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            ...data as Omit<Post, 'id'>,
            commentsCount: Math.max(0, data['commentsCount'] || 0)
          };
        } else {
          console.warn(`Post con ID ${postId} non trovato.`);
          return null;
        }
      }),
      catchError(error => {
        console.error(`Errore nel recupero del post ${postId}:`, error);
        return of(null);
      })
    );
  }
  // ⭐⭐⭐ FINE NUOVO METODO ⭐⭐⭐

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
    let userLikedOrUnliked = false;

    if (like && !currentLikes.includes(userId)) {
      updatedLikes = [...currentLikes, userId];
      userLikedOrUnliked = true;
    } else if (!like && currentLikes.includes(userId)) {
      updatedLikes = currentLikes.filter(id => id !== userId);
      userLikedOrUnliked = true;
    } else {
      return;
    }

    try {
      await updateDoc(postRef, { likes: updatedLikes });

      if (userLikedOrUnliked) {
        const currentLoggedInUser = getAuth().currentUser;
        if (currentLoggedInUser && currentLoggedInUser.uid === userId) {
          await this.userDataService.updateLikeGivenCount(like ? 1 : -1);
        }
      }
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
