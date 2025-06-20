// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private user: any = null;

  constructor() {
    const stored = localStorage.getItem('user');
    if (stored) {
      this.user = JSON.parse(stored);
    }
  }

  getUser() {
    return this.user;
  }

  isLoggedIn(): boolean {
    return this.user !== null;
  }

  setUser(userData: any) {
    this.user = userData;
    localStorage.setItem('user', JSON.stringify(userData));
  }

  logout() {
    this.user = null;
    localStorage.removeItem('user');
  }
}
