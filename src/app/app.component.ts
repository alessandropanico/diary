import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from './services/auth.service';
import { MenuController, AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

import { UserDataService } from './services/user-data.service';
import { getAuth } from 'firebase/auth';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
  template: `
    <button *ngIf="showInstallButton" (click)="installApp()">Installa App</button>
    <router-outlet></router-outlet>
  `
})
export class AppComponent implements OnInit, OnDestroy  {

  profile: any = null;
  userSub!: Subscription;

  // Aggiungiamo 'profilePhotoUrl' per gestire l'URL dell'immagine da Firestore
  profilePhotoUrl: string | null = null;

  deferredPrompt: any;
  showInstallButton = false;

  constructor(
    private menu: MenuController,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private router: Router,
    private userDataService: UserDataService,


  ) {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton = true;
    });

  }

async ngOnInit() {
    // Sottoscriviti all'observable dell'utente di AuthService
    // (Presuppone che AuthService abbia un modo per notificare i cambiamenti di stato dell'utente)
    this.userSub = this.authService.getUserObservable().subscribe(user => {
      // Quando l'utente cambia (login/logout), aggiorna la foto del profilo
      if (user) {
        this.loadProfilePhoto(); // Carica la foto da Firestore
      } else {
        this.profilePhotoUrl = 'assets/immaginiGenerali/default-avatar.jpg'; // Reset se logout
      }
    });

    // Carica la foto iniziale all'avvio dell'app se l'utente è già loggato
    const currentUser = getAuth().currentUser;
    if (currentUser) {
      await this.loadProfilePhoto();
    }
  }

  ngOnDestroy() {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }




  toggleMenu() {
    this.menu.toggle();
  }

  closeMenu() {
    this.menu.close();  // Chiude il menu dopo il click
  }

  async installApp() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const choiceResult = await this.deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      console.log('Utente ha accettato di installare l\'app');
    } else {
      console.log('Utente ha rifiutato l\'installazione');
    }
    this.deferredPrompt = null;
    this.showInstallButton = false;
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }



   getProfilePhoto(): string {
    return this.profilePhotoUrl || 'assets/immaginiGenerali/default-avatar.jpg';
  }

  loadProfile() {
    const storedProfile = localStorage.getItem('profile');
    this.profile = storedProfile ? JSON.parse(storedProfile) : null;
  }

 async logout() {
    await this.authService.logout(); // Assicurati che authService.logout() faccia il signOut da Firebase
    this.closeMenu();

    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Logout effettuato con successo.',
      buttons: ['OK'],
      cssClass: 'ff7-alert',
    });

    await alert.present();

    // Reindirizza l'utente e ricarica (opzionale, router.navigate è più pulito)
    this.router.navigateByUrl('/home').then(() => {
      window.location.reload(); // Puoi provare a rimuovere questa riga se il reindirizzamento è sufficiente
    });
  }

  async loadProfilePhoto() {
    const currentUser = getAuth().currentUser;
    if (currentUser) {
      const userData = await this.userDataService.getUserData();
      if (userData && userData.photo) {
        this.profilePhotoUrl = userData.photo;
      } else if (currentUser.photoURL) {
        // Se non c'è una foto su Firestore, usa quella di Google Auth
        this.profilePhotoUrl = currentUser.photoURL;
      } else {
        this.profilePhotoUrl = 'assets/immaginiGenerali/default-avatar.jpg';
      }
    } else {
      this.profilePhotoUrl = 'assets/immaginiGenerali/default-avatar.jpg';
    }
  }



}
