import { Component, NgZone, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
// Importa User come FirebaseUser per chiarezza sul tipo di utente di Firebase
import { getAuth, signInWithCredential, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { environment } from 'src/environments/environment';
import { UserDataService } from 'src/app/services/user-data.service';
// IMPORTANTE: Abbiamo bisogno di questi import per Firestore
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

  // 'user' qui riflette solo lo stato corrente dell'utente loggato, per scopi di visualizzazione interna alla pagina
  user: any = null;

  constructor(
    private ngZone: NgZone,
    private alertCtrl: AlertController,
    private userDataService: UserDataService,
    private router: Router,
  ) { }

  ngOnInit() {
    // Questo è il listener fondamentale di Firebase Auth.
    // Garantisce che lo stato dell'app sia sempre sincronizzato con lo stato reale di Firebase Auth.
    onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      this.ngZone.run(() => {
        if (firebaseUser) {
          // *** Caso: Utente loggato con Firebase Auth ***
          this.user = { // Aggiorna la proprietà 'user' per la UI di questa pagina
            name: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            uid: firebaseUser.uid
          };

          // Rimosse le righe di localStorage.setItem qui, la sessione è gestita da Firebase Auth.

          // Reindirizza l'utente al profilo, ma solo se non si trova già lì.
          if (this.router.url !== '/profilo') {
            this.router.navigateByUrl('/profilo', { replaceUrl: true });
          }

        } else {
          // *** Caso: Utente DISCONNESSO da Firebase Auth ***
          this.user = null; // Pulisci la proprietà 'user' nella UI di questa pagina

          // Rimosse le righe di localStorage.removeItem qui.

          // Reindirizza l'utente alla pagina di login, ma solo se non si trova già lì.
          if (this.router.url !== '/login') {
            this.router.navigateByUrl('/login', { replaceUrl: true });
          }
        }
      });
    });

    // Caricamento dello script di Google Identity Services (GSI)
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    // Inizializzazione di GSI una volta che lo script è caricato
    script.onload = () => {
      google.accounts.id.initialize({
        // IMPORTANTE: Ora usa environment.googleClientId
        client_id: environment.googleClientId,
        callback: (response: any) => this.ngZone.run(() => this.handleCredentialResponse(response))
      });

      google.accounts.id.renderButton(
        document.getElementById('googleSignInDiv'),
        { theme: 'outline', size: 'large' }
      );

      // Mostra il prompt One Tap solo se l'utente non è già autenticato con Firebase Auth.
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

      // Accedi a Firestore tramite userDataService per salvare/aggiornare i dati utente.
      // Assicurati che 'firestore' sia accessibile pubblicamente o tramite un getter nel tuo UserDataService.
      const userDocRef = doc(this.userDataService['firestore'], 'users', firebaseUser.uid);
      const docSnap = await getDoc(userDocRef); // Leggiamo il documento per verificare se esiste

      let dataToSave: any = {
        email: firebaseUser.email,
        photo: firebaseUser.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
        lastLogin: new Date().toISOString(),
      };

      // Logica per la persistenza del nickname/nome
      if (!docSnap.exists()) {
        // Se è un nuovo utente, imposta tutti i campi iniziali, incluso nickname.
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
          createdAt: new Date().toISOString() // Solo per i nuovi utenti
        };
      } else {
        // Se l'utente esiste già, aggiorna i dati ma mantieni il nickname e il nome esistenti
        // se l'utente li ha personalizzati.
        const existingData = docSnap.data();
        dataToSave.name = existingData['name'] || firebaseUser.displayName;
        dataToSave.nickname = existingData['nickname'] || existingData['name'] || firebaseUser.displayName;
        // Non sovrascrivere 'createdAt' se esiste
        if (existingData['createdAt']) {
            dataToSave.createdAt = existingData['createdAt'];
        }
      }

      // Salva/aggiorna i dati utente su Firestore.
      await this.userDataService.saveUserData(dataToSave);

      const alert = await this.alertCtrl.create({
        header: 'Accesso riuscito',
        message: `Benvenuto ${firebaseUser.displayName || firebaseUser.email}`,
        buttons: ['OK'],
        cssClass: 'ff7-alert',
      });
      await alert.present();

      // Il reindirizzamento è gestito dal listener 'onAuthStateChanged' in ngOnInit.
      // Non è necessario duplicarlo qui.
      // this.ngZone.run(() => {
      //   this.router.navigateByUrl('/profilo', { replaceUrl: true });
      // });

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

  // Questo metodo parseJwt non è strettamente necessario per l'autenticazione Firebase-Google
  // perché Firebase gestisce le credenziali direttamente. Puoi rimuoverlo se non lo usi altrove.
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
    // Esegue il logout da Firebase Auth.
    // Questo a sua volta triggererà il listener 'onAuthStateChanged' in 'ngOnInit',
    // che si occuperà di pulire lo stato locale della pagina e di reindirizzare.
    await signOut(auth);

    // Mostra un alert di conferma dopo il logout.
    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Logout effettuato con successo.',
      buttons: ['OK'],
      cssClass: 'ff7-alert',
    });
    await alert.present();

    // Anche il reindirizzamento è gestito dal listener 'onAuthStateChanged'.
    // Rimuovendo questo, si evita una possibile corsa tra i reindirizzamenti.
    // this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  renderGoogleButton() {
    const container = document.getElementById('googleSignInDiv');
    // Renderizza il bottone Google solo se il container esiste e non ha già figli (per evitare duplicati)
    if (container && container.childElementCount === 0) {
      google.accounts.id.renderButton(
        container,
        { theme: 'outline', size: 'large' }
      );
      // Il prompt One Tap è già gestito in ngOnInit per essere mostrato solo quando necessario.
      // google.accounts.id.prompt();
    }
  }
}
