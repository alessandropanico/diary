// src/app/services/post.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, getDoc, startAfter, where } from '@angular/fire/firestore';
import { Observable, from, lastValueFrom, of } from 'rxjs';
import { map, switchMap, catchError, take } from 'rxjs/operators';
import { Post } from '../interfaces/post';
import { UserDataService } from './user-data.service';
import { getAuth } from 'firebase/auth';
import { NotificheService } from './notifiche.service';
import { FollowService } from './follow.service';

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private postsCollection = collection(this.firestore, 'posts');

  constructor(
    private firestore: Firestore,
    private userDataService: UserDataService,
    private notificheService: NotificheService,
    private followService: FollowService

  ) { }

  async createPost(post: Omit<Post, 'id' | 'likes' | 'commentsCount'>): Promise<string> {
    try {
      const docRef = await addDoc(this.postsCollection, {
        ...post,
        likes: [],
        commentsCount: 0
      });

      const postId = docRef.id;

      const currentUserId = getAuth().currentUser?.uid;
      if (currentUserId) {
        try {
          // ⭐⭐ CORREZIONE QUI: Aggiunto '.pipe(take(1))' e gestito il caso di errore
          const followers = await lastValueFrom(this.followService.getFollowersIds(currentUserId).pipe(
            take(1),
            catchError(error => {
              console.error('Errore nel recupero dei follower:', error);
              return of([]); // Restituisce un Observable di un array vuoto in caso di errore
            })
          ));

          // ⭐⭐ CORREZIONE QUI: Aggiunto un controllo più robusto sul tipo
          if (Array.isArray(followers) && followers.length > 0) {
            for (const followerId of followers) {
              if (followerId !== currentUserId) {
                await this.notificheService.aggiungiNotifica({
                  userId: followerId,
                  titolo: 'Nuovo post!',
                  messaggio: `${post.username} ha pubblicato un nuovo post.`,
                  tipo: 'nuovo_post',
                  postId: postId,
                  letta: false, // ⭐⭐ CORREZIONE: Aggiunto il campo 'letta'
                });
              }
            }
          }
        } catch (err) {
          console.error('Impossibile recuperare i follower o inviare le notifiche:', err);
        }
      }
      return postId;
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

    const postData = postDoc.data() as Post;
    const currentLikes: string[] = postData?.likes || [];

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

      if (like && postData.userId !== userId) {
        const likerUserData = await this.userDataService.getUserDataByUid(userId);
        const likerUsername = likerUserData?.nickname || 'Un utente';

        await this.notificheService.aggiungiNotifica({
          userId: postData.userId,
          titolo: 'Nuovo "Mi piace"!',
          messaggio: `${likerUsername} ha messo mi piace al tuo post.`,
          tipo: 'mi_piace',
          postId: postId,
          letta: false,
        });
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

  // ⭐⭐⭐ INIZIO NUOVO METODO PER IL FEED NOTIZIE ⭐⭐⭐
  getFollowingUsersPosts(followingIds: string[], limitPosts: number = 10, startAfterTimestamp: string | null = null): Observable<Post[]> {
    // Se la lista di utenti seguiti è vuota, restituisci un Observable che emette un array vuoto
    if (!followingIds || followingIds.length === 0) {
      return of([]);
    }

    return from(this.getFollowingUsersPostsQuery(followingIds, limitPosts, startAfterTimestamp)).pipe(
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
        console.error('Errore nel recupero dei post degli utenti seguiti:', error);
        return of([]);
      })
    );
  }

  private async getFollowingUsersPostsQuery(followingIds: string[], limitPosts: number, startAfterTimestamp: string | null) {
    let q;
    // Firestore ha un limite di 10 per la clausola 'in', quindi è importante che followingIds non superi 10.
    // Se segui più di 10 utenti, dovrai fare più query o ripensare la struttura dei dati.
    // Per ora, presupponiamo che la lista sia gestibile.

    if (startAfterTimestamp) {
      q = query(
        this.postsCollection,
        where('userId', 'in', followingIds),
        orderBy('timestamp', 'desc'),
        startAfter(startAfterTimestamp),
        limit(limitPosts)
      );
    } else {
      q = query(
        this.postsCollection,
        where('userId', 'in', followingIds),
        orderBy('timestamp', 'desc'),
        limit(limitPosts)
      );
    }
    return getDocs(q);
  }
}
