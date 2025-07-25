import { Injectable, NgZone } from '@angular/core'; 
import { getAuth, User } from 'firebase/auth';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthStateService {
  private _isAuthenticated = new BehaviorSubject<boolean | null>(null);

  constructor(private ngZone: NgZone) {
    const auth = getAuth();
    auth.onAuthStateChanged(user => {
      this.ngZone.run(() => {
        this._isAuthenticated.next(!!user);
      });
    });
  }

  isAuthenticated$(): Observable<boolean | null> {
    return this._isAuthenticated.asObservable();
  }

  isLoggedInSync(): boolean {
    return this._isAuthenticated.value === true;
  }
}
