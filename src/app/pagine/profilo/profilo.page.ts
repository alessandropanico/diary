import { Component, OnInit, NgZone, OnDestroy } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { UserDataService } from 'src/app/services/user-data.service';
import { FollowService } from 'src/app/services/follow.service';
import { getAuth, User, onAuthStateChanged } from 'firebase/auth';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profilo',
  templateUrl: './profilo.page.html',
  styleUrls: ['./profilo.page.scss'],
  standalone: false,
})
export class ProfiloPage implements OnInit, OnDestroy {

  profile = {
    photo: '',
    banner: '',
    nickname: '',
    name: '',
    email: '',
    bio: '',
    status: ''
  };

  profileEdit = {
    photo: '',
    banner: '',
    nickname: '',
    name: '',
    email: '',
    bio: '',
    status: ''
  };

  editing = false;
  isLoading = true;
  avatarMarginTop = '-60px';

  loggedInUserId: string | null = null;
  followersCount = 0;
  followingCount = 0;

  private authStateUnsubscribe: (() => void) | undefined;
  private followersCountSubscription: Subscription | undefined;
  private followingCountSubscription: Subscription | undefined;

  isLoadingStats: boolean = true;

  private userStatusSubscription: Subscription | undefined; // Sottoscrizione per lo status


  constructor(
    private ngZone: NgZone,
    private alertCtrl: AlertController,
    private userDataService: UserDataService,
    private followService: FollowService,
    private router: Router,
  ) { }

    async ngOnInit() {
    this.isLoading = true;
    this.isLoadingStats = true;

    const auth = getAuth();
    this.authStateUnsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      this.ngZone.run(async () => {
        if (user) {
          this.loggedInUserId = user.uid;
          await this.loadProfileData(user);
          this.subscribeToFollowCounts(user.uid);
          this.subscribeToUserStatus(); // ⭐ NUOVO: Sottoscrivi allo status
        } else {
          this.loggedInUserId = null;
          // Resetta il profilo se l'utente non è loggato
          this.profile = { photo: '', banner: '', nickname: '', name: '', email: '', bio: '', status: '' };
          this.profileEdit = { ...this.profile };
          this.isLoading = false;
          this.isLoadingStats = false;
          console.warn('ProfiloPage: Nessun utente loggato.');
        }
      });
    });
  }

  async loadProfileData(user: User) {
    try {
      const firestoreData = await this.userDataService.getUserData();

      let initialProfileData: any = {};

      if (firestoreData) {
        initialProfileData = {
          photo: firestoreData.photo || user.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
          banner: firestoreData.banner || 'assets/immaginiGenerali/default-banner.jpg',
          nickname: firestoreData.nickname || user.displayName?.split(' ')[0] || '',
          name: firestoreData.name || user.displayName || '',
          email: firestoreData.email || user.email || '',
          bio: firestoreData.bio || '',
          status: firestoreData.status ?? ''
        };
      } else {
        initialProfileData = {
          photo: user.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
          banner: 'assets/immaginiGenerali/default-banner.jpg',
          nickname: user.displayName?.split(' ')[0] || '',
          name: user.displayName || '',
          email: user.email || '',
          bio: '',
          status: '' // ⭐ Default a stringa vuota per i nuovi utenti ⭐
        };
        await this.userDataService.saveUserData(initialProfileData);
      }

      this.profile = { ...initialProfileData };
      this.profileEdit = { ...this.profile };

    } catch (error) {
      console.error("Errore durante il caricamento/salvataggio iniziale da Firestore:", error);
      await this.presentFF7Alert('Errore nel caricamento del profilo. Riprova più tardi.');
      this.profile = { photo: 'assets/immaginiGenerali/default-avatar.jpg', banner: 'assets/immaginiGenerali/default-banner.jpg', nickname: '', name: '', email: '', bio: '', status: '' };
      this.profileEdit = { ...this.profile };
    } finally {
      this.isLoading = false;
    }
  }

  private subscribeToFollowCounts(userId: string) {
    if (this.followersCountSubscription) this.followersCountSubscription.unsubscribe();
    if (this.followingCountSubscription) this.followingCountSubscription.unsubscribe();

    let loadedCount = 0;

    this.followersCountSubscription = this.followService.getFollowersCount(userId).subscribe(count => {
      this.ngZone.run(() => {
        this.followersCount = count;
        loadedCount++;
        if (loadedCount === 2) {
          this.isLoadingStats = false;
        }
      });
    }, error => {
      console.error('Errore nel recupero dei follower count:', error);
      this.ngZone.run(() => {
        this.followersCount = 0;
        loadedCount++;
        if (loadedCount === 2) {
          this.isLoadingStats = false;
        }
      });
    });

    this.followingCountSubscription = this.followService.getFollowingCount(userId).subscribe(count => {
      this.ngZone.run(() => {
        this.followingCount = count;
        loadedCount++;
        if (loadedCount === 2) {
          this.isLoadingStats = false;
        }
      });
    }, error => {
      console.error('Errore nel recupero del following count:', error);
      this.ngZone.run(() => {
        this.followingCount = 0;
        loadedCount++;
        if (loadedCount === 2) {
          this.isLoadingStats = false;
        }
      });
    });
  }

    private subscribeToUserStatus() {
    if (this.userStatusSubscription) this.userStatusSubscription.unsubscribe();

    this.userStatusSubscription = this.userDataService.userStatus$.subscribe(status => {
      this.ngZone.run(() => {
        this.profile.status = status ?? '';
        if (this.editing) {
          this.profileEdit.status = this.profile.status;
        }
      });
    });
  }

  startEdit() {
    this.editing = true;
    this.profileEdit = { ...this.profile };
    this.avatarMarginTop = '20px';
  }

  cancelEdit() {
    this.editing = false;
    this.profileEdit = { ...this.profile };
    this.avatarMarginTop = '-60px';
  }

  async saveProfile() {
    this.isLoading = true;

    this.profile = {
      photo: this.profileEdit.photo,
      banner: this.profileEdit.banner,
      nickname: this.profileEdit.nickname || '',
      name: this.profileEdit.name || '',
      email: this.profileEdit.email || '',
      bio: this.profileEdit.bio || '',
      status: this.profileEdit.status ?? ''
    };

    try {
      await this.userDataService.saveUserData(this.profile);
      await this.presentFF7Alert('Profilo aggiornato e salvato!');
    } catch (error) {
      console.error('Errore durante il salvataggio del profilo:', error);
      await this.presentFF7Alert('Errore durante il salvataggio del profilo.');
    } finally {
      this.editing = false;
      this.profileEdit = { ...this.profile };
      this.isLoading = false;
      this.avatarMarginTop = '-60px';
    }
  }

  onStatusSelected(newStatus: string) {
    this.ngZone.run(async () => {
      this.profileEdit.status = newStatus;
    });
  }

  goToFollowersList() {
    if (this.loggedInUserId) {
      this.router.navigate(['/followers-list', this.loggedInUserId]);
    }
  }

  goToFollowingList() {
    if (this.loggedInUserId) {
      this.router.navigate(['/following-list', this.loggedInUserId]);
    }
  }

  async presentFF7Alert(message: string) {
    const alert = await this.alertCtrl.create({
      cssClass: 'ff7-alert',
      header: '✔️ Salvataggio',
      message,
      buttons: [
        {
          text: 'OK',
          cssClass: 'ff7-alert-button',
          role: 'cancel'
        }
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }

  async changeBanner() {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos
    });

    if (image.dataUrl) {
      this.ngZone.run(() => {
        this.profileEdit.banner = image.dataUrl!;
      });
    }
  }

  removeBanner() {
    this.profileEdit.banner = 'assets/immaginiGenerali/default-banner.jpg';
  }

  async changePhoto() {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos
    });

    if (image.dataUrl) {
      this.ngZone.run(() => {
        this.profileEdit.photo = image.dataUrl!;
      });
    }
  }

  removePhoto() {
    this.profileEdit.photo = 'assets/immaginiGenerali/default-avatar.jpg';
  }

  ngOnDestroy(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    if (this.followersCountSubscription) {
      this.followersCountSubscription.unsubscribe();
    }
    if (this.followingCountSubscription) {
      this.followingCountSubscription.unsubscribe();
    }
    if (this.userStatusSubscription) { // ⭐ AGGIUNGI QUESTO!
      this.userStatusSubscription.unsubscribe();
    }
  }
}
