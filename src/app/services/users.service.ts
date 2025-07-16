import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, query, limit, startAfter, orderBy, updateDoc, setDoc, deleteDoc } from '@angular/fire/firestore'; // Aggiunto deleteDoc
import { getAuth } from 'firebase/auth';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { AppUser } from '../interfaces/app-user';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private pageSize = 10;

  private _followingStatus = new BehaviorSubject<Set<string>>(new Set<string>());

  getFollowingStatus(): Observable<Set<string>> {
    return this._followingStatus.asObservable();
  }

  constructor(private firestore: Firestore) {
    getAuth().onAuthStateChanged(user => {
      if (user) {
        this.loadFollowingStatus(user.uid);
      } else {
        this._followingStatus.next(new Set<string>());
      }
    });
  }

  // AGGIORNATO: Carica gli ID degli utenti che l'utente corrente segue
  private async loadFollowingStatus(userId: string) {
    try {
      const followingCollectionRef = collection(this.firestore, `users/${userId}/following`);
      const q = query(followingCollectionRef); // Non serve ordinare o limitare se si vogliono tutti
      const querySnapshot = await getDocs(q); // Ottieni tutti i documenti nella sottocollezione

      const followingIds = new Set<string>();
      querySnapshot.forEach(doc => {
        followingIds.add(doc.id); // L'ID del documento è l'ID dell'utente seguito
      });

      this._followingStatus.next(followingIds);

    } catch (error) {
      console.error('Errore nel caricare lo stato dei following:', error);
      this._followingStatus.next(new Set<string>());
    }
  }

  async refreshFollowingStatus() {
    const auth = getAuth();
    if (auth.currentUser) {
      await this.loadFollowingStatus(auth.currentUser.uid);
    } else {
      this._followingStatus.next(new Set<string>());
    }
  }

  // Metodo per ottenere utenti paginati (nessun cambiamento qui)
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

  // AGGIORNATO: Metodo per fare/togliere il follow
  async toggleFollow(targetUserId: string): Promise<void> {
    const auth = getAuth();
    const currentUserId = auth.currentUser?.uid;

    if (!currentUserId || !targetUserId) {
      console.error('Utente non autenticato o ID target mancante.');
      return;
    }

    // Aggiorna localmente lo stato per reattività immediata
    const currentFollowingIds = this._followingStatus.getValue();
    const newFollowingIds = new Set(currentFollowingIds);
    const isCurrentlyFollowing = currentFollowingIds.has(targetUserId);

    try {
      if (isCurrentlyFollowing) {
        newFollowingIds.delete(targetUserId); // Rimuovi localmente
        // Rimuovi il documento dalla lista 'following' dell'utente corrente
        const currentUserFollowingDocRef = doc(this.firestore, `users/${currentUserId}/following/${targetUserId}`);
        await deleteDoc(currentUserFollowingDocRef);

        // Rimuovi il documento dalla lista 'followers' dell'utente target
        const targetUserFollowersDocRef = doc(this.firestore, `users/${targetUserId}/followers/${currentUserId}`);
        await deleteDoc(targetUserFollowersDocRef);
      } else {
        newFollowingIds.add(targetUserId); // Aggiungi localmente
        // Aggiungi il documento alla lista 'following' dell'utente corrente
        const currentUserFollowingDocRef = doc(this.firestore, `users/${currentUserId}/following/${targetUserId}`);
        await setDoc(currentUserFollowingDocRef, { timestamp: new Date().toISOString() }); // Puoi mettere data o vuoto

        // Aggiungi il documento alla lista 'followers' dell'utente target
        const targetUserFollowersDocRef = doc(this.firestore, `users/${targetUserId}/followers/${currentUserId}`);
        await setDoc(targetUserFollowersDocRef, { timestamp: new Date().toISOString() }); // Puoi mettere data o vuoto
      }
      this._followingStatus.next(newFollowingIds); // Aggiorna lo stato locale

    } catch (error) {
      console.error(`Errore durante l'operazione ${isCurrentlyFollowing ? 'unfollow' : 'follow'} per ${targetUserId}:`, error);
      // In caso di errore, ripristina lo stato precedente
      this._followingStatus.next(currentFollowingIds);
      throw error; // Propaga l'errore per gestirlo nel componente
    }
  }

  // Metodi per i dati utente (nessun cambiamento qui)
  async getUserData(): Promise<AppUser | null> {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
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
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
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
