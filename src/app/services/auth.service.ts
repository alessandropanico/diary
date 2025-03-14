import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserProfile {
  fullName: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  address: string;
  description: string;
  profileImage: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private tokenKey = 'authToken';
  private usersKey = 'users';
  private currentUserKey = 'currentUser';
  private currentUserSubject: BehaviorSubject<string | null>;

  constructor() {
    const currentUser = localStorage.getItem(this.currentUserKey);
    this.currentUserSubject = new BehaviorSubject<string | null>(currentUser);
  }

  getCurrentUser(): Observable<string | null> {
    return this.currentUserSubject.asObservable();
  }

  private setCurrentUser(username: string | null): void {
    if (username) {
      localStorage.setItem(this.currentUserKey, username);
    } else {
      localStorage.removeItem(this.currentUserKey);
    }
    this.currentUserSubject.next(username);
  }

  register(username: string, password: string): boolean {
    const users = this.getUsers();
    if (users.find((user) => user.username === username)) {
      alert('Registration failed. Username already exists.');
      return false; // Username already exists
    }
    users.push({ username, password });
    localStorage.setItem(this.usersKey, JSON.stringify(users));

    // Automatically log in the user after registration
    const token = 'dummy-token'; // This would be a JWT token in a real app
    localStorage.setItem(this.tokenKey, token);
    this.setCurrentUser(username);

    // Initialize an empty profile for the new user
    const emptyProfile: UserProfile = {
      fullName: '',
      email: '',
      phoneNumber: '',
      birthDate: '',
      address: '',
      description: '',
      profileImage: '',
    };
    this.saveUserProfile(emptyProfile);

    alert('Registration successful. You are now logged in.');
    return true;
  }

  login(username: string, password: string): boolean {
    const users = this.getUsers();
    const user = users.find(
      (user) => user.username === username && user.password === password
    );
    if (user) {
      const token = 'dummy-token'; // This would be a JWT token in a real app
      localStorage.setItem(this.tokenKey, token);
      this.setCurrentUser(username);
      return true;
    }
    return false;
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.setCurrentUser(null);
    alert('You have been logged out.');
  }

  isLoggedIn(): boolean {
    return localStorage.getItem(this.tokenKey) !== null;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private getUsers(): { username: string; password: string }[] {
    const usersJson = localStorage.getItem(this.usersKey);
    return usersJson ? JSON.parse(usersJson) : [];
  }

  getUserProfile(): UserProfile | null {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      const profileJson = localStorage.getItem(`profile_${currentUser}`);
      return profileJson ? JSON.parse(profileJson) : null;
    }
    return null;
  }

  saveUserProfile(profile: UserProfile): void {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      localStorage.setItem(`profile_${currentUser}`, JSON.stringify(profile));
    }
  }

  getUserPhotos(): { src: string, lat?: number, lng?: number }[] {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      const photosJson = localStorage.getItem(`photos_${currentUser}`);
      return photosJson ? JSON.parse(photosJson) : [];
    }
    return [];
  }

  saveUserPhotos(photos: { src: string, lat?: number, lng?: number }[]): void {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      localStorage.setItem(`photos_${currentUser}`, JSON.stringify(photos));
    }
  }
}
