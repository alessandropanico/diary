import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, setDoc, deleteDoc, query, onSnapshot } from '@angular/fire/firestore'; // Aggiungi onSnapshot
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FollowService {

  constructor(private firestore: Firestore) { }

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
      console.error('followUser: ID utente mancante.');
      return;
    }
    if (currentUserId === followedUserId) {
      console.warn('followUser: Un utente non può seguire se stesso.');
      return;
    }

    // 1. Aggiungi currentUserId ai followers di followedUserId
    const followerDocRef = doc(this.firestore, `users/${followedUserId}/followers/${currentUserId}`);
    await setDoc(followerDocRef, { timestamp: new Date().toISOString() }); // Aggiungi un timestamp

    // 2. Aggiungi followedUserId alla lista di following di currentUserId
    const followingDocRef = doc(this.firestore, `users/${currentUserId}/following/${followedUserId}`);
    await setDoc(followingDocRef, { timestamp: new Date().toISOString() }); // Aggiungi un timestamp

    console.log(`Utente ${currentUserId} ha iniziato a seguire ${followedUserId}`);
  }

  /**
   * Un utente smette di seguire un altro utente.
   * Rimuove i due documenti creati in followUser.
   * @param currentUserId L'ID dell'utente che smette di seguire.
   * @param followedUserId L'ID dell'utente che non viene più seguito.
   */
  async unfollowUser(currentUserId: string, followedUserId: string): Promise<void> {
    if (!currentUserId || !followedUserId) {
      console.error('unfollowUser: ID utente mancante.');
      return;
    }

    // 1. Rimuovi currentUserId dai followers di followedUserId
    const followerDocRef = doc(this.firestore, `users/${followedUserId}/followers/${currentUserId}`);
    await deleteDoc(followerDocRef);

    // 2. Rimuovi followedUserId dalla lista di following di currentUserId
    const followingDocRef = doc(this.firestore, `users/${currentUserId}/following/${followedUserId}`);
    await deleteDoc(followingDocRef);

    console.log(`Utente ${currentUserId} ha smesso di seguire ${followedUserId}`);
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
      return from(Promise.resolve(false));
    }
    const docRef = doc(this.firestore, `users/${currentUserId}/following/${targetUserId}`);
    // Utilizza onSnapshot per un aggiornamento in tempo reale
    return new Observable<boolean>(observer => {
      const unsubscribe = onSnapshot(docRef, docSnap => {
        observer.next(docSnap.exists());
      }, error => {
        console.error('Errore in isFollowing onSnapshot:', error);
        observer.error(error);
      });
      return unsubscribe; // Restituisce la funzione di unsubscribe per pulire
    });
  }

  /**
   * Recupera il conteggio dei follower per un dato utente.
   * @param userId L'ID dell'utente.
   * @returns Un Observable che emette il numero di follower.
   */
  getFollowersCount(userId: string): Observable<number> {
    if (!userId) {
      return from(Promise.resolve(0));
    }
    const followersCollectionRef = collection(this.firestore, `users/${userId}/followers`);
    const q = query(followersCollectionRef);
    // Utilizza onSnapshot per un aggiornamento in tempo reale
    return new Observable<number>(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.size);
      }, error => {
        console.error('Errore in getFollowersCount onSnapshot:', error);
        observer.error(error);
      });
      return unsubscribe; // Restituisce la funzione di unsubscribe per pulire
    });
  }

  /**
   * Recupera il conteggio delle persone che un dato utente segue.
   * @param userId L'ID dell'utente.
   * @returns Un Observable che emette il numero di persone seguite.
   */
  getFollowingCount(userId: string): Observable<number> {
    if (!userId) {
      return from(Promise.resolve(0));
    }
    const followingCollectionRef = collection(this.firestore, `users/${userId}/following`);
    const q = query(followingCollectionRef);
    // Utilizza onSnapshot per un aggiornamento in tempo reale
    return new Observable<number>(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.size);
      }, error => {
        console.error('Errore in getFollowingCount onSnapshot:', error);
        observer.error(error);
      });
      return unsubscribe; // Restituisce la funzione di unsubscribe per pulire
    });
  }

  /**
   * Recupera la lista degli ID dei follower di un utente.
   * @param userId L'ID dell'utente.
   * @returns Un Observable che emette un array di stringhe (UID dei follower).
   */
  getFollowersIds(userId: string): Observable<string[]> {
    if (!userId) {
      return from(Promise.resolve([]));
    }
    const followersCollectionRef = collection(this.firestore, `users/${userId}/followers`);
    const q = query(followersCollectionRef);
    return new Observable<string[]>(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(doc => doc.id));
      }, error => {
        console.error('Errore in getFollowersIds onSnapshot:', error);
        observer.error(error);
      });
      return unsubscribe;
    });
  }

  /**
   * Recupera la lista degli ID degli utenti seguiti da un utente.
   * @param userId L'ID dell'utente.
   * @returns Un Observable che emette un array di stringhe (UID degli utenti seguiti).
   */
  getFollowingIds(userId: string): Observable<string[]> {
    if (!userId) {
      return from(Promise.resolve([]));
    }
    const followingCollectionRef = collection(this.firestore, `users/${userId}/following`);
    const q = query(followingCollectionRef);
    return new Observable<string[]>(observer => {
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(doc => doc.id));
      }, error => {
        console.error('Errore in getFollowingIds onSnapshot:', error);
        observer.error(error);
      });
      return unsubscribe;
    });
  }
}
