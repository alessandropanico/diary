// src/app/login/login.page.ts

import { Component, NgZone, OnInit, OnDestroy } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCredential, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { environment } from 'src/environments/environment';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
// ⭐ MODIFICA 1: Importa il nuovo servizio di presenza
import { PresenceService } from 'src/app/services/presence.service';

const app = initializeApp(environment.firebaseConfig);
const auth = getAuth(app);

declare const google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit, OnDestroy {
  user: any = null;
  // ⭐ RIMOSSO: Eliminata la variabile per l'intervallo
  // private onlineStatusInterval: any;

  constructor(
    private ngZone: NgZone,
    private alertCtrl: AlertController,
    private userDataService: UserDataService,
    private router: Router,
    // ⭐ MODIFICA 2: Inietta il nuovo servizio nel costruttore
    private presenceService: PresenceService
  ) { }

  ngOnInit() {
    onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      this.ngZone.run(() => {
        if (firebaseUser) {
          this.user = {
            name: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            uid: firebaseUser.uid
          };

          // ⭐ MODIFICA 3: Chiama il nuovo servizio per impostare la presenza
          this.presenceService.setPresence();

          // ⭐ RIMOSSO: Eliminata la chiamata di aggiornamento di lastOnline
          // this.userDataService.setLastOnline().catch(err => {
          //   console.error("Errore nell'aggiornamento di lastOnline all'inizializzazione del login:", err);
          // });

          // ⭐ RIMOSSO: Eliminata la chiamata per avviare l'aggiornamento periodico
          // this.startOnlineStatusUpdater();

          if (this.router.url !== '/profilo') {
            this.router.navigateByUrl('/profilo', { replaceUrl: true });
          }

        } else {
          this.user = null;
          // ⭐ RIMOSSO: Eliminata la chiamata per interrompere l'aggiornamento periodico
          // this.stopOnlineStatusUpdater();
          if (this.router.url !== '/login') {
            this.router.navigateByUrl('/login', { replaceUrl: true });
          }
        }
      });
    });

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: any) => this.ngZone.run(() => this.handleCredentialResponse(response))
      });

      google.accounts.id.renderButton(
        document.getElementById('googleSignInDiv'),
        { theme: 'outline', size: 'large' }
      );

      if (!auth.currentUser) {
        google.accounts.id.prompt();
      }
    };
  }

  ngOnDestroy(): void {
    // ⭐ RIMOSSO: Non è più necessario interrompere l'aggiornamento, il servizio lo gestisce
    // this.stopOnlineStatusUpdater();
  }

  async handleCredentialResponse(response: any) {
    try {
      const credential = GoogleAuthProvider.credential(response.credential);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseUser = userCredential.user;

      const dataToUpdate: Partial<UserDashboardCounts> = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        lastLogin: new Date().toISOString(),
        lastOnline: new Date().toISOString(),
      };

      await this.userDataService.saveUserData(dataToUpdate);

      const alert = await this.alertCtrl.create({
        header: 'Accesso riuscito',
        message: `Benvenuto ${firebaseUser.displayName || firebaseUser.email}`,
        buttons: ['OK'],
        cssClass: 'ff7-alert',
      });
      await alert.present();

    } catch (error: any) {
      console.error('Errore durante login Firebase:', error);
      const alert = await this.alertCtrl.create({
        header: 'Errore Login',
        message: `Impossibile autenticarti: ${error.message}`,
        buttons: ['OK'],
        cssClass: 'ff7-alert',
      });
      await alert.present();
    }
  }

  parseJwt(token: string) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Errore decodifica JWT', e);
      return null;
    }
  }

  async logout() {
    await signOut(auth);
    // ⭐ RIMOSSO: non è più necessario
    // this.stopOnlineStatusUpdater();

    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Logout effettuato con successo.',
      buttons: ['OK'],
      cssClass: 'ff7-alert',
    });
    await alert.present();
  }

  renderGoogleButton() {
    const container = document.getElementById('googleSignInDiv');
    if (container && container.childElementCount === 0) {
      google.accounts.id.renderButton(
        container,
        { theme: 'outline', size: 'large' }
      );
    }
  }

  // ⭐ RIMOSSO: Eliminati i due metodi obsoleti
  // private startOnlineStatusUpdater() {
  //   if (this.onlineStatusInterval) {
  //     clearInterval(this.onlineStatusInterval);
  //   }
  //   this.onlineStatusInterval = setInterval(() => {
  //     this.userDataService.setLastOnline().catch(err => {
  //       console.error("Errore nell'aggiornamento periodico di lastOnline:", err);
  //     });
  //   }, 30000);
  // }
  //
  // private stopOnlineStatusUpdater() {
  //   if (this.onlineStatusInterval) {
  //     clearInterval(this.onlineStatusInterval);
  //     this.onlineStatusInterval = null;
  //   }
  // }
}
