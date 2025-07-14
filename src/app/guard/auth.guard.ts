import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { from } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> {
    const auth = getAuth();
    return new Observable<any>(observer => {
      const unsubscribe = auth.onAuthStateChanged(user => {
        observer.next(user);
        observer.complete();
      });
      return unsubscribe;
    }).pipe(
      take(1),
      map(user => {
        if (user) {
          return true;
        } else {
          console.warn('AuthGuard: Utente non autenticato, reindirizzamento al login.');
          return this.router.createUrlTree(['/login']);
        }
      })
    );
  }
}
