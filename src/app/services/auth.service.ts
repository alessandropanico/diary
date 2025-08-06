import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { getAuth, User } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private userSubject = new BehaviorSubject<any>(null);
  private _user = new BehaviorSubject<User | null>(null);
  user$ = this._user.asObservable();

  constructor() {
    const stored = localStorage.getItem('user');
    if (stored) {
      this.userSubject.next(JSON.parse(stored));
    }

    const auth = getAuth();
    auth.onAuthStateChanged(user => {
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
  }

  async logout() {
    this.userSubject.next(null);
    localStorage.removeItem('user');
    const auth = getAuth();
    try {
      await auth.signOut();
      this._user.next(null);
    } catch (error) {
      console.error('AuthService: Errore durante il logout da Firebase Auth:', error);
    }
  }
}
