import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
// Importa getAuth e User se necessario (User non è strettamente necessario se usi 'any')
import { getAuth, User } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // Questo BehaviorSubject gestisce lo stato utente per il tuo AuthService (da localStorage)
  private userSubject = new BehaviorSubject<any>(null);

  // Il _user e user$ qui sotto sembrano essere un duplicato non usato,
  // se non li usi altrove, potresti considerarli ridondanti.
  // Se invece intendi che user$ debba riflettere l'utente Firebase Auth,
  // allora il suo comportamento andrebbe sincronizzato con onAuthStateChanged
  // o potresti semplicemente usare FirebaseAuthStateService per quello.
  // Per ora, li lascio ma sono da valutare.
  private _user = new BehaviorSubject<User | null>(null);
  user$ = this._user.asObservable();

  constructor() {
    const stored = localStorage.getItem('user');
    if (stored) {
      this.userSubject.next(JSON.parse(stored));
    }

    // Inizializza _user e user$ con lo stato di Firebase Auth se vuoi che riflettano Firebase
    // Questo è opzionale se FirebaseAuthStateService è l'unico che li usa.
    // Se user$ è usato altrove e vuoi che rifletta l'utente Firebase:
    const auth = getAuth();
    auth.onAuthStateChanged(user => {
        // Aggiorna anche il BehaviorSubject basato su Firebase se lo usi
        this._user.next(user);
    });
  }

  getUser() {
    return this.userSubject.value;
  }

  getUserObservable() {
    return this.userSubject.asObservable();
  }

  isLoggedIn(): boolean {
    return this.userSubject.value !== null;
  }

  setUser(userData: any) {
    this.userSubject.next(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    // Quando imposti l'utente (probabilmente dopo un login/registrazione),
    // dovresti anche assicurarti che Firebase Auth sia nello stato corretto.
    // Se la tua logica di login è altrove e chiama già signInWith... di Firebase,
    // allora non serve fare nulla qui, perché onAuthStateChanged si attiverà.
  }

  async logout() {
    // 1. Pulisci lo stato di login del tuo AuthService (localStorage e BehaviorSubject)
    this.userSubject.next(null);
    localStorage.removeItem('user');

    // 2. *** AGGIUNTA FONDAMENTALE ***
    // Disconnetti l'utente anche da Firebase Authentication.
    // Questa azione triggererà l'evento onAuthStateChanged.
    const auth = getAuth();
    try {
      await auth.signOut();
      this._user.next(null); // Aggiorna anche l'altro BehaviorSubject se lo stai usando
      console.log('AuthService: Utente disconnesso da Firebase Auth.');
    } catch (error) {
      console.error('AuthService: Errore durante il logout da Firebase Auth:', error);
      // Potresti voler gestire l'errore o notificare l'utente
    }
  }
}
