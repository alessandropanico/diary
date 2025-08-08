// src/app/app.component.ts

import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { MenuController, AlertController, ModalController } from '@ionic/angular'; // ⭐ AGGIUNTO ModalController
import { Subject, Subscription, interval } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import { Router } from '@angular/router';
import { UserDataService } from './services/user-data.service';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';

import { SearchModalComponent } from './shared/search-modal/search-modal.component';
import { ChatNotificationService } from './services/chat-notification.service';
import { GroupChatNotificationService } from './services/group-chat-notification.service';
import { FirebaseAuthStateService } from './services/firebase-auth-state.service';
import { NotificationsModalComponent } from './shared/notifications-modal/notifications-modal.component';

import { environment } from 'src/environments/environment';
const app = initializeApp(environment.firebaseConfig);

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {

  profile: any = null;
  unreadCountSub: Subscription | undefined;
  unreadGroupCountSub: Subscription | undefined;
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
  unreadGroupCount = 0;
  totalUnreadCount = 0;

  firebaseIsLoggedIn: boolean | null = null;
  private onlineStatusUpdateSubscription: Subscription | undefined;

  constructor(
    private menu: MenuController,
    private alertCtrl: AlertController,
    private router: Router,
    private userDataService: UserDataService,
    private modalCtrl: ModalController, // ⭐ INIETTATO ModalController
    private chatNotificationService: ChatNotificationService,
    private groupChatNotificationService: GroupChatNotificationService,
    private firebaseAuthStateService: FirebaseAuthStateService,
    private ngZone: NgZone,
    private cdRef: ChangeDetectorRef
  ) {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton = true;
    });
  }

  async ngOnInit() {
    this.firebaseAuthStateService.isAuthenticated$().subscribe(async isLoggedIn => {
      this.firebaseIsLoggedIn = isLoggedIn;
      await this.loadProfilePhoto();

      if (isLoggedIn) {
        this.startOnlineStatusUpdater();
      } else {
        this.stopOnlineStatusUpdater();
      }
    });

    this.unreadCountSub = this.chatNotificationService.getUnreadCount$().subscribe(count => {
      this.unreadCount = count;
      this.updateTotalUnreadCount();
    });

    this.unreadGroupCountSub = this.groupChatNotificationService.getUnreadGroupCount$().subscribe(count => {
      this.unreadGroupCount = count;
      this.updateTotalUnreadCount();
    });

    setTimeout(() => {
      this.showSplash = false;
    }, 3500);
  }

  ngOnDestroy() {
    this.unreadCountSub?.unsubscribe();
    this.unreadGroupCountSub?.unsubscribe();
    this.searchSubscription?.unsubscribe();
    this.stopOnlineStatusUpdater();
  }

  private updateTotalUnreadCount() {
    this.ngZone.run(() => {
      this.totalUnreadCount = this.unreadCount + this.unreadGroupCount;
      this.cdRef.detectChanges();
    });
  }

  private startOnlineStatusUpdater() {
    this.stopOnlineStatusUpdater();
    this.onlineStatusUpdateSubscription = interval(30000)
      .pipe(
        takeWhile(() => this.firebaseIsLoggedIn === true)
      )
      .subscribe(() => {
        this.userDataService.setLastOnline().catch(err => {
          console.error("Errore nell'aggiornamento dello stato online:", err);
        });
      });
  }

  private stopOnlineStatusUpdater() {
    if (this.onlineStatusUpdateSubscription) {
      this.onlineStatusUpdateSubscription.unsubscribe();
      this.onlineStatusUpdateSubscription = undefined;
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
    } else {
    }
    this.deferredPrompt = null;
    this.showInstallButton = false;
  }

  isLoggedIn(): boolean {
    return !!this.firebaseIsLoggedIn;
  }

  getProfilePhoto(): string {
    return this.profilePhotoUrl || 'assets/immaginiGenerali/default-avatar.jpg';
  }

  async logout() {
    const authInstance = getAuth();
    await signOut(authInstance);

    this.closeMenu();
    this.stopOnlineStatusUpdater();
    this.router.navigateByUrl('/login');

    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Logout effettuato con successo.',
      buttons: ['OK'],
      cssClass: 'ff7-alert',
    });
    await alert.present();
  }

  async loadProfilePhoto() {
    const currentUser = getAuth().currentUser;
    if (currentUser) {
      const userData = await this.userDataService.getUserData();
      if (userData && (userData.profilePictureUrl || userData.photo)) {
        this.profilePhotoUrl = userData.profilePictureUrl || userData.photo;
      }
      else if (currentUser.photoURL) {
        this.profilePhotoUrl = currentUser.photoURL;
      }
      else {
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

  // ⭐ NUOVO METODO PER APRIRE LA MODALE DELLE NOTIFICHE ⭐
  async openNotificationsModal() {
    if (!this.isLoggedIn()) {
      const alert = await this.alertCtrl.create({
        header: 'Accesso Necessario',
        message: 'Devi essere loggato per visualizzare le notifiche.',
        buttons: ['OK'],
        cssClass: 'ff7-alert',
      });
      await alert.present();
      return;
    }

    const modal = await this.modalCtrl.create({
      component: NotificationsModalComponent,
      cssClass: 'ff7-modal-fullscreen'
    });

    return await modal.present();
  }
}
