import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, query, limit, startAfter, orderBy, updateDoc, arrayUnion, arrayRemove, setDoc } from '@angular/fire/firestore';
import { getAuth } from 'firebase/auth';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { AppUser } from '../interfaces/app-user';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private pageSize = 10; // Quanti utenti caricare per pagina

  // *** Gestione dello stato dei Following: Usiamo BehaviorSubject per reattività ***
  private _followingStatus = new BehaviorSubject<Set<string>>(new Set<string>());

  // Observable per ottenere lo stato corrente dei following
  getFollowingStatus(): Observable<Set<string>> {
    return this._followingStatus.asObservable();
  }

  constructor(private firestore: Firestore) {
    // Carica lo stato dei following all'avvio del servizio e ogni volta che cambia lo stato di autenticazione
    getAuth().onAuthStateChanged(user => {
      if (user) {
        this.loadFollowingStatus(user.uid);
      } else {
        this._followingStatus.next(new Set<string>()); // Resetta se non loggato
      }
    });
  }

  // Carica gli ID degli utenti che l'utente corrente segue
  private async loadFollowingStatus(userId: string) {
    try {
      const docRef = doc(this.firestore, `users/${userId}/following/${userId}`); // Doc specifico per gli ID seguiti
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const followingIds = new Set<string>(data ? data['ids'] || [] : []);
        this._followingStatus.next(followingIds);
        console.log('UsersService: Stato following caricato:', followingIds);
      } else {
        this._followingStatus.next(new Set<string>()); // Nessun following ancora
        console.log('UsersService: Nessun documento following trovato. Inizializzato a vuoto.');
      }
    } catch (error) {
      console.error('Errore nel caricare lo stato dei following:', error);
      this._followingStatus.next(new Set<string>()); // Resetta in caso di errore
    }
  }

  // Metodo per ricaricare forzatamente lo stato dei following (usato per refresh)
  async refreshFollowingStatus() {
    const auth = getAuth();
    if (auth.currentUser) {
      await this.loadFollowingStatus(auth.currentUser.uid);
    } else {
      this._followingStatus.next(new Set<string>());
    }
  }

  // Metodo per ottenere utenti paginati
  getPaginatedUsers(lastVisible: any = null): Observable<{ users: AppUser[], lastVisible: any }> {
    const usersCollection = collection(this.firestore, 'users');
    let q = query(usersCollection, orderBy('nickname'), limit(this.pageSize)); // Ordina per nickname

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
        return of({ users: [], lastVisible: null }); // Restituisci un Observable vuoto in caso di errore
      })
    );
  }

  // Metodo per fare/togliere il follow
  async toggleFollow(targetUserId: string): Promise<void> {
    const auth = getAuth();
    const currentUserId = auth.currentUser?.uid;

    if (!currentUserId || !targetUserId) {
      console.error('Utente non autenticato o ID target mancante.');
      return;
    }

    // Aggiorna localmente lo stato per reattività immediata
    const currentFollowingIds = this._followingStatus.getValue();
    const newFollowingIds = new Set(currentFollowingIds); // Crea una copia

    const isCurrentlyFollowing = currentFollowingIds.has(targetUserId);

    if (isCurrentlyFollowing) {
      newFollowingIds.delete(targetUserId);
      console.log(`Unfollowing: ${targetUserId}`);
    } else {
      newFollowingIds.add(targetUserId);
      console.log(`Following: ${targetUserId}`);
    }
    this._followingStatus.next(newFollowingIds); // Aggiorna lo stato locale immediatamente

    try {
      // 1. Aggiorna la lista 'following' dell'utente corrente
      const currentUserFollowingRef = doc(this.firestore, `users/${currentUserId}/following/${currentUserId}`);
      // Usa setDoc con merge per creare il documento se non esiste, o aggiornarlo
      await setDoc(currentUserFollowingRef, {
        ids: isCurrentlyFollowing ? arrayRemove(targetUserId) : arrayUnion(targetUserId)
      }, { merge: true });

      // 2. Aggiorna la lista 'followers' dell'utente target
      const targetUserFollowersRef = doc(this.firestore, `users/${targetUserId}/followers/${targetUserId}`);
      await setDoc(targetUserFollowersRef, {
        ids: isCurrentlyFollowing ? arrayRemove(currentUserId) : arrayUnion(currentUserId)
      }, { merge: true });

      console.log(`Operazione ${isCurrentlyFollowing ? 'unfollow' : 'follow'} completata per ${targetUserId}`);
    } catch (error) {
      console.error(`Errore durante l'operazione ${isCurrentlyFollowing ? 'unfollow' : 'follow'} per ${targetUserId}:`, error);
      // In caso di errore, ripristina lo stato precedente
      this._followingStatus.next(currentFollowingIds);
      throw error; // Propaga l'errore se vuoi gestirlo nel componente
    }
  }

  // Metodi per i dati utente
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
