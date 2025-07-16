// src/app/services/follow.service.ts
import { Injectable, NgZone } from '@angular/core'; // AGGIUNGI NgZone
import { Firestore, collection, setDoc, deleteDoc, query, onSnapshot } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';
import { Observable, from, of } from 'rxjs'; // <-- AGGIUNGI 'of' QUI
import { getFirestore, doc, runTransaction, getDoc, FieldValue, increment } from 'firebase/firestore'; // AGGIUNGI 'increment' QUI

@Injectable({
  providedIn: 'root'
})
export class FollowService {

  constructor(private firestore: Firestore, private ngZone: NgZone) { } // INIETTA NgZone

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

    } catch (error) {
      console.error(`FollowService: Errore durante followUser tra ${currentUserId} e ${followedUserId}:`, error);
      throw error; // Rilancia l'errore per essere gestito dal componente chiamante
    }
  }

  /**
   * Un utente smette di seguire un altro utente.
   * Rimuove i due documenti creati in followUser.
   * @param currentUserId L'ID dell'utente che smette di seguire.
   * @param followedUserId L'ID dell'utente che non viene più seguito.
   */
  // All'interno di follow.service.ts
  async unfollowUser(followerId: string, followedId: string): Promise<void> {
    if (!followerId || !followedId) {
      console.warn('FollowService: unfollowUser chiamato con ID mancanti.');
      throw new Error('ID follower o followed mancanti per unfollow.');
    }

    const db = getFirestore();

    // Riferimento al documento "following" nella sottocollezione dell'utente che smette di seguire
    const followerRef = doc(db, 'users', followerId, 'following', followedId);

    // Riferimento al documento "followers" nella sottocollezione dell'utente che viene smesso di seguire
    // --- QUESTA ERA LA RIGA CON L'ERRORE ---
    const followedRef = doc(db, 'users', followedId, 'followers', followerId); // CORREZIONE QUI!

    // Riferimenti ai contatori
    const followerUserRef = doc(db, 'users', followerId);
    const followedUserRef = doc(db, 'users', followedId);

    try {
      await runTransaction(db, async (transaction) => {
        // ... (il resto del codice della transazione è corretto se i riferimenti sopra lo sono)
        // 1. Controlla se esistono i documenti prima di tentare di eliminarli
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

        // 2. Decrementa i contatori solo se il documento esisteva e viene eliminato
        if (followerDoc.exists()) { // Contatore "following" per chi smette di seguire
          transaction.update(followerUserRef, {
            followingCount: increment(-1)
          });
        }

        if (followedDoc.exists()) { // Contatore "followers" per chi viene smesso di seguire
          transaction.update(followedUserRef, {
            followersCount: increment(-1)
          });
        }
      });
    } catch (error) {
      console.error(`FollowService: Errore nella transazione unfollowUser per ${followerId} -> ${followedId}:`, error);
      throw error; // Rilancia l'errore affinché il componente lo possa catturare
    }
  }

  /**
   * Controlla se l'utente corrente sta seguendo un altro utente.
   * Questo è particolarmente utile per il profilo di altri utenti.
   * @param currentUserId L'ID dell'utente corrente.
   * @param targetUserId L'ID dell'utente di cui verificare il follow.
   * @returns Un Observable che emette true se segue, false altrimenti.
   */
  isFollowing(currentUserId: string, targetUserId: string): Observable<boolean> {
    if (!currentUserId || !targetUserId) {
      console.warn('FollowService: isFollowing - ID utente mancante, ritorno Observable di false.');
      return of(false); // Usa of() direttamente per gli Observable completati immediatamente
    }
    const docRef = doc(this.firestore, `users/${currentUserId}/following/${targetUserId}`);
    return new Observable<boolean>(observer => {
      const unsubscribe = onSnapshot(docRef, docSnap => {
        // ESSENZIALE: Esegui all'interno della zona di Angular
        this.ngZone.run(() => {
          observer.next(docSnap.exists());
        });
      }, error => {
        // ESSENZIALE: Esegui all'interno della zona di Angular
        this.ngZone.run(() => {
          console.error(`FollowService: Errore in isFollowing onSnapshot per ${currentUserId}/${targetUserId}:`, error);
          observer.error(error);
        });
      });
      return () => { // Funzione di cleanup
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
        // ESSENZIALE: Esegui all'interno della zona di Angular
        this.ngZone.run(() => {
          observer.next(snapshot.size);
        });
      }, error => {
        // ESSENZIALE: Esegui all'interno della zona di Angular
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
        // ESSENZIALE: Esegui all'interno della zona di Angular
        this.ngZone.run(() => {
          const ids = snapshot.docs.map(doc => doc.id);
          observer.next(ids);
        });
      }, error => {
        // ESSENZIALE: Esegui all'interno della zona di Angular
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
        // ESSENZIALE: Esegui all'interno della zona di Angular
        this.ngZone.run(() => {
          const ids = snapshot.docs.map(doc => doc.id);
          observer.next(ids);
        });
      }, error => {
        // ESSENZIALE: Esegui all'interno della zona di Angular
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
