// src/app/services/users.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, query, limit, startAfter, orderBy, updateDoc, setDoc, deleteDoc } from '@angular/fire/firestore';
import { getAuth } from 'firebase/auth';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AppUser } from '../interfaces/app-user';
// ⭐ 1. Importa il FollowService
import { FollowService } from './follow.service';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private pageSize = 10;
  private auth = getAuth(); // Aggiunto per un accesso più pulito

  private _followingStatus = new BehaviorSubject<Set<string>>(new Set<string>());

  getFollowingStatus(): Observable<Set<string>> {
    return this._followingStatus.asObservable();
  }

  // ⭐ 2. Iniettiamo il FollowService nel costruttore
  constructor(private firestore: Firestore, private followService: FollowService) {
    this.auth.onAuthStateChanged(user => {
      if (user) {
        this.loadFollowingStatus(user.uid);
      } else {
        this._followingStatus.next(new Set<string>());
      }
    });
  }

  // Metodo per caricare gli ID degli utenti che l'utente corrente segue
  private async loadFollowingStatus(userId: string) {
    try {
      const followingCollectionRef = collection(this.firestore, `users/${userId}/following`);
      const q = query(followingCollectionRef);
      const querySnapshot = await getDocs(q);

      const followingIds = new Set<string>();
      querySnapshot.forEach(doc => {
        followingIds.add(doc.id);
      });

      this._followingStatus.next(followingIds);
    } catch (error) {
      console.error('Errore nel caricare lo stato dei following:', error);
      this._followingStatus.next(new Set<string>());
    }
  }

  async refreshFollowingStatus() {
    if (this.auth.currentUser) {
      await this.loadFollowingStatus(this.auth.currentUser.uid);
    } else {
      this._followingStatus.next(new Set<string>());
    }
  }

  getPaginatedUsers(lastVisible: any = null): Observable<{ users: AppUser[], lastVisible: any }> {
    const usersCollection = collection(this.firestore, 'users');
    let q = query(usersCollection, orderBy('nickname'), limit(this.pageSize));

    if (lastVisible) {
      q = query(usersCollection, orderBy('nickname'), startAfter(lastVisible), limit(this.pageSize));
    }

    return from(getDocs(q)).pipe(
      map(snapshot => {
        const users: AppUser[] = [];
        snapshot.docs.forEach(doc => {
          users.push({ uid: doc.id, ...doc.data() } as AppUser);
        });
        const newLastVisible = snapshot.docs[snapshot.docs.length - 1];
        return { users, lastVisible: newLastVisible };
      }),
      catchError(error => {
        console.error('Errore nel recupero utenti paginati:', error);
        return of({ users: [], lastVisible: null });
      })
    );
  }

  // ⭐ 3. AGGIORNATO: Il metodo toggleFollow ora chiama il FollowService quando un utente viene seguito
  async toggleFollow(targetUserId: string): Promise<void> {
    const currentUserId = this.auth.currentUser?.uid;

    if (!currentUserId || !targetUserId) {
      console.error('Utente non autenticato o ID target mancante.');
      return;
    }

    const currentFollowingIds = this._followingStatus.getValue();
    const newFollowingIds = new Set(currentFollowingIds);
    const isCurrentlyFollowing = currentFollowingIds.has(targetUserId);

    try {
      if (isCurrentlyFollowing) {
        newFollowingIds.delete(targetUserId);
        const currentUserFollowingDocRef = doc(this.firestore, `users/${currentUserId}/following/${targetUserId}`);
        await deleteDoc(currentUserFollowingDocRef);

        const targetUserFollowersDocRef = doc(this.firestore, `users/${targetUserId}/followers/${currentUserId}`);
        await deleteDoc(targetUserFollowersDocRef);
      } else {
        newFollowingIds.add(targetUserId);
        const currentUserFollowingDocRef = doc(this.firestore, `users/${currentUserId}/following/${targetUserId}`);
        await setDoc(currentUserFollowingDocRef, { timestamp: new Date().toISOString() });

        const targetUserFollowersDocRef = doc(this.firestore, `users/${targetUserId}/followers/${currentUserId}`);
        await setDoc(targetUserFollowersDocRef, { timestamp: new Date().toISOString() });

        // ⭐⭐ NOVITÀ: Chiama il metodo del FollowService per inviare la notifica
        await this.followService.followUser(currentUserId, targetUserId);
      }

      this._followingStatus.next(newFollowingIds);
    } catch (error) {
      console.error(`Errore durante l'operazione ${isCurrentlyFollowing ? 'unfollow' : 'follow'} per ${targetUserId}:`, error);
      this._followingStatus.next(currentFollowingIds);
      throw error;
    }
  }

  async getUserData(): Promise<AppUser | null> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return null;

    try {
      const docRef = doc(this.firestore, `users/${userId}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { uid: docSnap.id, ...docSnap.data() } as AppUser;
      }
      return null;
    } catch (error) {
      console.error("Errore nel recupero dati utente:", error);
      return null;
    }
  }

  async updateUserData(data: Partial<AppUser>): Promise<void> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) throw new Error('Utente non autenticato');

    try {
      const userDocRef = doc(this.firestore, `users/${userId}`);
      await updateDoc(userDocRef, data);
    } catch (error) {
      console.error("Errore nell'aggiornamento dati utente:", error);
      throw error;
    }
  }
}
