import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from './services/auth.service';
import { MenuController, AlertController, ModalController } from '@ionic/angular';
import { Subject, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { UserDataService } from './services/user-data.service';
import { getAuth } from 'firebase/auth';
import { SearchModalComponent } from './shared/search-modal/search-modal.component';

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
export class AppComponent implements OnInit, OnDestroy {

  profile: any = null;
  userSub!: Subscription;

  profilePhotoUrl: string | null = null;

  deferredPrompt: any;
  showInstallButton = false;
  showSplash = true;

    // --- Proprietà per la Ricerca Utenti ---
  searchQuery: string = '';
  searchResults: any[] = [];
  isSearchingUsers: boolean = false;
  searchPerformed: boolean = false;
  private searchTerms = new Subject<string>();
  private searchSubscription: Subscription | undefined;

  constructor(
    private menu: MenuController,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private router: Router,
    private userDataService: UserDataService,
        private modalCtrl: ModalController // Inietta ModalController


  ) {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton = true;
    });
  }

  async ngOnInit() {
    this.userSub = this.authService.getUserObservable().subscribe(user => {
      if (user) {
        this.loadProfilePhoto();
      } else {
        this.profilePhotoUrl = 'assets/immaginiGenerali/default-avatar.jpg';
      }
    });

    const currentUser = getAuth().currentUser;
    if (currentUser) {
      await this.loadProfilePhoto();
    }

  setTimeout(() => {
    this.showSplash = false;
  }, 3500);
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
    this.menu.close();
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
    await this.authService.logout();
    this.closeMenu();

    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Logout effettuato con successo.',
      buttons: ['OK'],
      cssClass: 'ff7-alert',
    });

    await alert.present();

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
        this.profilePhotoUrl = currentUser.photoURL;
      } else {
        this.profilePhotoUrl = 'assets/immaginiGenerali/default-avatar.jpg';
      }
    } else {
      this.profilePhotoUrl = 'assets/immaginiGenerali/default-avatar.jpg';
    }
  }

  // --- Metodi per il menu di ricerca ---
async openSearchMenu() {
    await this.menu.open('search-menu');
    await this.menu.close('first'); // Chiudi il menu principale se aperto
    this.searchQuery = '';
    this.searchResults = [];
    this.searchPerformed = false;
    this.isSearchingUsers = false;
  }

  // Metodo per chiudere il menu di ricerca
  closeSearchMenu() {
    this.menu.close('search-menu');
  }

  // Gestore input per la searchbar
  onSearchInput(event: any) {
    this.searchQuery = event.target.value;
    this.searchTerms.next(this.searchQuery);
  }

    // NUOVO METODO PER APRIRE IL MODALE DI RICERCA
  async presentSearchModal() {
    const modal = await this.modalCtrl.create({
      component: SearchModalComponent,
      cssClass: 'search-modal' // Una classe CSS opzionale per stilizzare il modale
    });
    await modal.present();
    await this.menu.close('first'); // Chiudi il menu principale quando si apre il modale
  }

}
