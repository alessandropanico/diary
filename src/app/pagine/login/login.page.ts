import { Component, NgZone, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCredential, GoogleAuthProvider, signOut } from 'firebase/auth';
import { environment } from 'src/environments/environment';

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
  ) { }

  ngOnInit() {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.user = JSON.parse(storedUser);
    }

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

      google.accounts.id.prompt();
    };
  }

  async handleCredentialResponse(response: any) {
  try {
    const credential = GoogleAuthProvider.credential(response.credential);
    const userCredential = await signInWithCredential(auth, credential);
    const firebaseUser = userCredential.user;

    this.user = {
      name: firebaseUser.displayName,
      email: firebaseUser.email,
      photoURL: firebaseUser.photoURL,
      uid: firebaseUser.uid
    };

    localStorage.setItem('user', JSON.stringify(this.user));

    const alert = await this.alertCtrl.create({
      header: 'Accesso riuscito',
      message: `Benvenuto ${this.user.name}`,
      buttons: ['OK'],
      cssClass: 'ff7-alert',
    });
    await alert.present();

    window.location.href = '/profilo';
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
  this.user = null;
  localStorage.removeItem('user');

  const alert = await this.alertCtrl.create({
    header: 'Logout',
    message: 'Logout effettuato con successo.',
    buttons: ['OK'],
    cssClass: 'ff7-alert',
  });

  await alert.present();

  setTimeout(() => {
    this.renderGoogleButton();
    window.location.reload();
  }, 0);
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
