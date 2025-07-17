import { Component, NgZone, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCredential, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { environment } from 'src/environments/environment';
import { UserDataService } from 'src/app/services/user-data.service';
import { doc, getDoc } from 'firebase/firestore';

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
  ) {}

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

          if (this.router.url !== '/profilo') {
            this.router.navigateByUrl('/profilo', { replaceUrl: true });
          }

        } else {
          this.user = null;
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

  async handleCredentialResponse(response: any) {
    try {
      const credential = GoogleAuthProvider.credential(response.credential);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseUser = userCredential.user;

      const userDocRef = doc(this.userDataService['firestore'], 'users', firebaseUser.uid);
      const docSnap = await getDoc(userDocRef);

      let dataToSave: any = {
        email: firebaseUser.email,
        lastLogin: new Date().toISOString(),
      };

      if (!docSnap.exists()) {
        const fullName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Nuovo Utente';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const initialNickname = fullName;

        dataToSave = {
          ...dataToSave,
          name: fullName,
          nickname: initialNickname,
          firstName: firstName,
          lastName: lastName,
          photo: firebaseUser.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
          createdAt: new Date().toISOString()
        };
      } else {
        const existingData = docSnap.data();
        dataToSave = {
          ...dataToSave,
          name: existingData['name'] || firebaseUser.displayName,
          nickname: existingData['nickname'] || existingData['name'] || firebaseUser.displayName,
          photo: existingData['photo'] || firebaseUser.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
          createdAt: existingData['createdAt'] || new Date().toISOString()
        };
      }

      await this.userDataService.saveUserData(dataToSave);

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
}
