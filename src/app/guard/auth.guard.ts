// src/app/guards/auth.guard.ts (o dove si trova il tuo AuthGuard)
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { getAuth } from 'firebase/auth'; // Importa getAuth
import { from } from 'rxjs'; // Per convertire Promise in Observable

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> {
    const auth = getAuth(); // Ottieni l'istanza di autenticazione Firebase

    // Utilizza onAuthStateChanged per ottenere lo stato di autenticazione in tempo reale
    // Lo avvolgiamo in un Observable per renderlo compatibile con CanActivate
    return new Observable<any>(observer => {
      const unsubscribe = auth.onAuthStateChanged(user => {
        observer.next(user);
        observer.complete();
      });
      // Importante: disiscriviti dall'observer dopo il primo valore,
      // altrimenti il guard potrebbe continuare a emettere valori non necessari.
      return unsubscribe;
    }).pipe(
      take(1), // Prendi solo il primo valore e poi completa
      map(user => {
        if (user) {
          // Utente autenticato
          return true;
        } else {
          // Utente NON autenticato, reindirizza alla pagina di login
          console.warn('AuthGuard: Utente non autenticato, reindirizzamento al login.');
          return this.router.createUrlTree(['/login']);
        }
      })
    );
  }
}
