import { Component, NgZone, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCredential, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { environment } from 'src/environments/environment';
import { UserDataService } from 'src/app/services/user-data.service';

const app = initializeApp(environment.firebaseConfig);
const auth = getAuth(app);

declare const google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {

  user: any = null;

  constructor(
    private ngZone: NgZone,
    private alertCtrl: AlertController,
    private userDataService: UserDataService,
    private router: Router,
  ) { }

  ngOnInit() {
    onAuthStateChanged(auth, firebaseUser => {
      this.ngZone.run(() => {
        if (firebaseUser) {
          this.user = {
            name: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            uid: firebaseUser.uid
          };
          localStorage.setItem('user', JSON.stringify(this.user));
        } else {
          this.user = null;
          localStorage.removeItem('user');
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
        client_id: '379328633803-nq9v84nsipbn5mdctnt3tgn3i9gap8c3.apps.googleusercontent.com',
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

  async handleCredentialResponse(response: any) {
    try {
      const credential = GoogleAuthProvider.credential(response.credential);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseUser = userCredential.user;

      const fullName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Nuovo Utente';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const initialNickname = fullName;

      await this.userDataService.saveUserData({
        name: fullName,
        email: firebaseUser.email,
        photo: firebaseUser.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
        nickname: initialNickname,
        firstName: firstName,
        lastName: lastName,
        lastLogin: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      const alert = await this.alertCtrl.create({
        header: 'Accesso riuscito',
        message: `Benvenuto ${firebaseUser.displayName || firebaseUser.email}`,
        buttons: ['OK'],
        cssClass: 'ff7-alert',
      });
      await alert.present();

      this.ngZone.run(() => {
        this.router.navigateByUrl('/profilo', { replaceUrl: true });
      });

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
    // onAuthStateChanged gestirà l'aggiornamento di this.user e la rimozione dal localStorage.
    // Non c'è bisogno di farlo manualmente qui.
    // this.user = null;
    // localStorage.removeItem('user');

    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Logout effettuato con successo.',
      buttons: ['OK'],
      cssClass: 'ff7-alert',
    });

    await alert.present();

    this.router.navigateByUrl('/login', { replaceUrl: true });
  }


  renderGoogleButton() {
    const container = document.getElementById('googleSignInDiv');
    if (container && container.childElementCount === 0) {
      google.accounts.id.renderButton(
        container,
        { theme: 'outline', size: 'large' }
      );
      google.accounts.id.prompt();
    }
  }

}
