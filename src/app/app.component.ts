import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from './services/auth.service';
import { MenuController, AlertController, ModalController } from '@ionic/angular';
import { Subject, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { UserDataService } from './services/user-data.service';
import { getAuth } from 'firebase/auth';
import { SearchModalComponent } from './shared/search-modal/search-modal.component';
import { ChatNotificationService } from './services/chat-notification.service';
import { FirebaseAuthStateService } from './services/firebase-auth-state.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {

  profile: any = null;
  userSub!: Subscription;
  unreadCountSub: Subscription | undefined;
  profilePhotoUrl: string | null = null;

  deferredPrompt: any;
  showInstallButton = false;
  showSplash = true;

  searchQuery: string = '';
  searchResults: any[] = [];
  isSearchingUsers: boolean = false;
  searchPerformed: boolean = false;
  private searchTerms = new Subject<string>();
  private searchSubscription: Subscription | undefined;
  unreadCount = 0;

  firebaseIsLoggedIn: boolean = false;

  constructor(
    private menu: MenuController,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private router: Router,
    private userDataService: UserDataService,
    private modalCtrl: ModalController,
    private chatNotificationService: ChatNotificationService,
    private firebaseAuthStateService: FirebaseAuthStateService,
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

    this.unreadCountSub = this.chatNotificationService.getUnreadCount$().subscribe(count => {
      this.unreadCount = count;
    });


    this.firebaseAuthStateService.isAuthenticated$().subscribe(isLoggedIn => {
      if (isLoggedIn !== null) {
        this.firebaseIsLoggedIn = isLoggedIn;
      }
    });

    setTimeout(() => {
      this.showSplash = false;
    }, 3500);
  }

  ngOnDestroy() {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
    this.unreadCountSub?.unsubscribe();
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
      window.location.reload();
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

  async openSearchMenu() {
    await this.menu.open('search-menu');
    await this.menu.close('first');
    this.searchQuery = '';
    this.searchResults = [];
    this.isSearchingUsers = false;
    this.searchPerformed = false;
  }

  closeSearchMenu() {
    this.menu.close('search-menu');
  }

  onSearchInput(event: any) {
    this.searchQuery = event.target.value;
    this.searchTerms.next(this.searchQuery);
  }

  async presentSearchModal() {
    if (this.firebaseIsLoggedIn) {
      const modal = await this.modalCtrl.create({
        component: SearchModalComponent,
        cssClass: 'search-modal'
      });
      await modal.present();
      await this.menu.close('first');
    } else {
      const alert = await this.alertCtrl.create({
        header: 'Accesso Necessario',
        message: 'Devi essere loggato per cercare altri utenti.',
        buttons: ['OK'],
        cssClass: 'ff7-alert',
      });
      await alert.present();
      this.router.navigateByUrl('/login');
      this.closeMenu();
    }
  }
}
