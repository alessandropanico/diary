// src/app/services/follow.service.ts
import { Injectable, NgZone } from '@angular/core';
import { Firestore, collection, setDoc, deleteDoc, query, onSnapshot } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';
import { Observable, from, of } from 'rxjs';
import { getFirestore, doc, runTransaction, getDoc, FieldValue, increment } from 'firebase/firestore';
import { NotificheService } from './notifiche.service';
import { UserDataService } from './user-data.service';

@Injectable({
  providedIn: 'root'
})
export class FollowService {

  constructor(
    private firestore: Firestore,
    private ngZone: NgZone,
    private notificheService: NotificheService,
    private userDataService: UserDataService
  ) { }

  /**
   * Un utente segue un altro utente.
   * Crea due documenti:
   * 1. In 'users/{followedUserId}/followers/{currentUserId}'
   * 2. In 'users/{currentUserId}/following/{followedUserId}'
   * @param currentUserId L'ID dell'utente che sta seguendo.
   * @param followedUserId L'ID dell'utente che viene seguito.
   */
  async followUser(currentUserId: string, followedUserId: string): Promise<void> {
    if (!currentUserId || !followedUserId) {
      console.error('FollowService: followUser - ID utente mancante.');
      return;
    }
    if (currentUserId === followedUserId) {
      console.warn('FollowService: followUser - Un utente non può seguire se stesso.');
      return;
    }

    try {
      // 1. Aggiungi currentUserId ai followers di followedUserId
      const followerDocRef = doc(this.firestore, `users/${followedUserId}/followers/${currentUserId}`);
      await setDoc(followerDocRef, { timestamp: new Date().toISOString() });

      // 2. Aggiungi followedUserId alla lista di following di currentUserId
      const followingDocRef = doc(this.firestore, `users/${currentUserId}/following/${followedUserId}`);
      await setDoc(followingDocRef, { timestamp: new Date().toISOString() });

      // ⭐⭐ CORREZIONE: Invia la notifica al followedUserId includendo anche l'ID del follower ⭐⭐
      const followerData = await this.userDataService.getUserDataById(currentUserId);
      if (followerData && followerData.nickname) {
        await this.notificheService.aggiungiNotificaNuovoFollower(followedUserId, followerData.nickname, currentUserId);
      }

    } catch (error) {
      console.error(`FollowService: Errore durante followUser tra ${currentUserId} e ${followedUserId}:`, error);
      throw error;
    }
  }

  /**
   * Un utente smette di seguire un altro utente.
   * Rimuove i due documenti creati in followUser.
   * @param currentUserId L'ID dell'utente che smette di seguire.
   * @param followedUserId L'ID dell'utente che non viene più seguito.
   */
  async unfollowUser(followerId: string, followedId: string): Promise<void> {
    if (!followerId || !followedId) {
      console.warn('FollowService: unfollowUser chiamato con ID mancanti.');
      throw new Error('ID follower o followed mancanti per unfollow.');
    }

    const db = getFirestore();

    const followerRef = doc(db, 'users', followerId, 'following', followedId);
    const followedRef = doc(db, 'users', followedId, 'followers', followerId);

    const followerUserRef = doc(db, 'users', followerId);
    const followedUserRef = doc(db, 'users', followedId);

    try {
      await runTransaction(db, async (transaction) => {
        const followerDoc = await transaction.get(followerRef);
        const followedDoc = await transaction.get(followedRef);

        if (followerDoc.exists()) {
          transaction.delete(followerRef);
        } else {
          console.warn(`FollowService: Documento users/${followerId}/following/${followedId} non esiste per l'eliminazione.`);
        }

        if (followedDoc.exists()) {
          transaction.delete(followedRef);
        } else {
          console.warn(`FollowService: Documento users/${followedId}/followers/${followerId} non esiste per l'eliminazione.`);
        }

        if (followerDoc.exists()) {
          transaction.update(followerUserRef, {
            followingCount: increment(-1)
          });
        }

        if (followedDoc.exists()) {
          transaction.update(followedUserRef, {
            followersCount: increment(-1)
          });
        }
      });
    } catch (error) {
      console.error(`FollowService: Errore nella transazione unfollowUser per ${followerId} -> ${followedId}:`, error);
      throw error;
    }
  }

  /**
   * Controlla se l'utente corrente sta seguendo un altro utente.
   * @param currentUserId L'ID dell'utente corrente.
   * @param targetUserId L'ID dell'utente di cui verificare il follow.
   * @returns Un Observable che emette true se segue, false altrimenti.
   */
  isFollowing(currentUserId: string, targetUserId: string): Observable<boolean> {
    if (!currentUserId || !targetUserId) {
      console.warn('FollowService: isFollowing - ID utente mancante, ritorno Observable di false.');
      return of(false);
    }
    const docRef = doc(this.firestore, `users/${currentUserId}/following/${targetUserId}`);
    return new Observable<boolean>(observer => {
      const unsubscribe = onSnapshot(docRef, docSnap => {
        this.ngZone.run(() => {
          observer.next(docSnap.exists());
        });
      }, error => {
        this.ngZone.run(() => {
          console.error(`FollowService: Errore in isFollowing onSnapshot per ${currentUserId}/${targetUserId}:`, error);
          observer.error(error);
        });
      });
      return () => {
        unsubscribe();
      };
    });
  }

  /**
   * Recupera il conteggio dei follower per un dato utente.
   * @param userId L'ID dell'utente.
   * @returns Un Observable che emette il numero di follower.
   */
  getFollowersCount(userId: string): Observable<number> {
    if (!userId) {
      console.warn('FollowService: getFollowersCount - ID utente mancante, ritorno Observable di 0.');
      return of(0);
    }
    const followersCollectionRef = collection(this.firestore, `users/${userId}/followers`);
    const q = query(followersCollectionRef);
    return new Observable<number>(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        this.ngZone.run(() => {
          observer.next(snapshot.size);
        });
      }, error => {
        this.ngZone.run(() => {
          console.error(`FollowService: Errore in getFollowersCount onSnapshot per ${userId}:`, error);
          observer.error(error);
        });
      });
      return () => {
        unsubscribe();
      };
    });
  }

  /**
   * Recupera il conteggio delle persone che un dato utente segue.
   * @param userId L'ID dell'utente.
   * @returns Un Observable che emette il numero di persone seguite.
   */
  getFollowingCount(userId: string): Observable<number> {
    if (!userId) {
      console.warn('FollowService: getFollowingCount - ID utente mancante, ritorno Observable di 0.');
      return of(0);
    }
    const followingCollectionRef = collection(this.firestore, `users/${userId}/following`);
    const q = query(followingCollectionRef);
    return new Observable<number>(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        this.ngZone.run(() => {
          observer.next(snapshot.size);
        });
      }, error => {
        this.ngZone.run(() => {
          console.error(`FollowService: Errore in getFollowingCount onSnapshot per ${userId}:`, error);
          observer.error(error);
        });
      });
      return () => {
        unsubscribe();
      };
    });
  }

  /**
   * Recupera la lista degli ID dei follower di un utente.
   * @param userId L'ID dell'utente.
   * @returns Un Observable che emette un array di stringhe (UID dei follower).
   */
  getFollowersIds(userId: string): Observable<string[]> {
    if (!userId) {
      console.warn('FollowService: getFollowersIds - ID utente mancante, ritorno Observable di array vuoto.');
      return of([]);
    }
    const followersCollectionRef = collection(this.firestore, `users/${userId}/followers`);
    const q = query(followersCollectionRef);
    return new Observable<string[]>(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        this.ngZone.run(() => {
          const ids = snapshot.docs.map(doc => doc.id);
          observer.next(ids);
        });
      }, error => {
        this.ngZone.run(() => {
          console.error(`FollowService: Errore in getFollowersIds onSnapshot per ${userId}:`, error);
          observer.error(error);
        });
      });
      return () => {
        unsubscribe();
      };
    });
  }

  /**
   * Recupera la lista degli ID degli utenti seguiti da un utente.
   * @param userId L'ID dell'utente.
   * @returns Un Observable che emette un array di stringhe (UID degli utenti seguiti).
   */
  getFollowingIds(userId: string): Observable<string[]> {
    if (!userId) {
      console.warn('FollowService: getFollowingIds - ID utente mancante, ritorno Observable di array vuoto.');
      return of([]);
    }
    const followingCollectionRef = collection(this.firestore, `users/${userId}/following`);
    const q = query(followingCollectionRef);
    return new Observable<string[]>(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        this.ngZone.run(() => {
          const ids = snapshot.docs.map(doc => doc.id);
          observer.next(ids);
        });
      }, error => {
        this.ngZone.run(() => {
          console.error(`FollowService: Errore in getFollowingIds onSnapshot per ${userId}:`, error);
          observer.error(error);
        });
      });
      return () => {
        unsubscribe();
      };
    });
  }
}
