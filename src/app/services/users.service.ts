import { Injectable } from '@angular/core';
import { collection, getFirestore, query, orderBy, limit, startAfter, getDocs, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

export interface AppUser {
  uid: string;
  nickname: string;
  firstName: string;
  lastName: string;
  photo: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private firestore = getFirestore();
  private usersCollection = collection(this.firestore, 'users');
  private pageSize = 20; // Numero di utenti da caricare per volta

  // Subject per lo stato dei follower/following
  private followingStatus = new BehaviorSubject<Set<string>>(new Set());

  constructor() {
    this.loadInitialFollowingStatus();
  }

  // Carica lo stato iniziale dei "following" dell'utente corrente
  private async loadInitialFollowingStatus() {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (currentUser) {
      const userDocRef = doc(this.firestore, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const following = new Set<string>(userData['following'] || []);
        this.followingStatus.next(following);
      }
    }
  }

  getFollowingStatus(): Observable<Set<string>> {
    return this.followingStatus.asObservable();
  }

  /**
   * Recupera una pagina di utenti.
   * @param lastVisible Il documento dell'ultimo utente caricato per la paginazione.
   * @returns Un oggetto contenente la lista di utenti e l'ultimo documento per la prossima paginazione.
   */
  getPaginatedUsers(lastVisible: any = null): Observable<{ users: AppUser[], lastVisible: any }> {
    let q;
    if (lastVisible) {
      q = query(this.usersCollection, orderBy('nickname'), startAfter(lastVisible), limit(this.pageSize));
    } else {
      q = query(this.usersCollection, orderBy('nickname'), limit(this.pageSize));
    }

    return from(getDocs(q)).pipe(
      map(snapshot => {
        const users: AppUser[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          // Filtra l'utente corrente dalla lista, se necessario
          const auth = getAuth();
          if (auth.currentUser && auth.currentUser.uid === doc.id) {
            return; // Salta l'utente corrente
          }
          users.push({
            uid: doc.id,
            nickname: data['nickname'] || 'N/A',
            firstName: data['firstName'] || '',
            lastName: data['lastName'] || '',
            photo: data['photo'] || 'assets/immaginiGenerali/default-avatar.jpg'
          });
        });
        const newLastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
        return { users, lastVisible: newLastVisible };
      })
    );
  }

  async toggleFollow(targetUserId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      console.warn('Utente non loggato, impossibile seguire.');
      return;
    }

    const currentUserId = currentUser.uid;
    const currentUserDocRef = doc(this.firestore, 'users', currentUserId);
    const targetUserDocRef = doc(this.firestore, 'users', targetUserId);

    const currentFollowing = this.followingStatus.value;
    const isCurrentlyFollowing = currentFollowing.has(targetUserId);

    try {
      if (isCurrentlyFollowing) {
        // Smetti di seguire
        await updateDoc(currentUserDocRef, {
          following: arrayRemove(targetUserId)
        });
        await updateDoc(targetUserDocRef, {
          followers: arrayRemove(currentUserId)
        });
        currentFollowing.delete(targetUserId);
        console.log(`Unfollowed ${targetUserId}`);
      } else {
        // Inizia a seguire
        await updateDoc(currentUserDocRef, {
          following: arrayUnion(targetUserId)
        });
        await updateDoc(targetUserDocRef, {
          followers: arrayUnion(currentUserId)
        });
        currentFollowing.add(targetUserId);
        console.log(`Followed ${targetUserId}`);
      }
      this.followingStatus.next(new Set(currentFollowing)); // Emetti il nuovo stato
    } catch (error) {
      console.error('Errore nel toggleFollow:', error);
      throw error;
    }
  }

  // Metodo per ricaricare lo stato dei "following" (utile al login/logout)
  async refreshFollowingStatus() {
    await this.loadInitialFollowingStatus();
  }
}
