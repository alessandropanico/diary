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
    bio: ''
  };

  profileEdit = {
    photo: '',
    banner: '',
    nickname: '',
    name: '',
    email: '',
    bio: ''
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

  constructor(
    private ngZone: NgZone,
    private alertCtrl: AlertController,
    private userDataService: UserDataService,
    private followService: FollowService,
    private router: Router, // Inietta Router
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    this.isLoadingStats = true; // Inizializza anche questo a true

    const auth = getAuth();
    this.authStateUnsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      this.ngZone.run(async () => {
        if (user) {
          this.loggedInUserId = user.uid;
          await this.loadProfileData(user);
          this.subscribeToFollowCounts(user.uid);
        } else {
          this.loggedInUserId = null;
          this.profile = { photo: '', banner: '', nickname: '', name: '', email: '', bio: '' };
          this.profileEdit = { ...this.profile };
          this.isLoading = false;
          this.isLoadingStats = false; // Se non c'è utente, non c'è nulla da caricare
          console.warn('ProfiloPage: Nessun utente loggato.');
          // this.router.navigateByUrl('/login'); // Decidi se reindirizzare
        }
      });
    });
  }

  async loadProfileData(user: User) {
    try {
      const firestoreData = await this.userDataService.getUserData();

      if (firestoreData) {
        this.profile = {
          photo: firestoreData.photo || user.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
          banner: firestoreData.banner || 'assets/immaginiGenerali/default-banner.jpg',
          nickname: firestoreData.nickname || user.displayName?.split(' ')[0] || '',
          name: firestoreData.name || user.displayName || '',
          email: firestoreData.email || user.email || '',
          bio: firestoreData.bio || ''
        };
      } else {
        this.profile = {
          photo: user.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
          banner: 'assets/immaginiGenerali/default-banner.jpg',
          nickname: user.displayName?.split(' ')[0] || '',
          name: user.displayName || '',
          email: user.email || '',
          bio: ''
        };
        await this.userDataService.saveUserData(this.profile);
      }
    } catch (error) {
      console.error("Errore durante il caricamento/salvataggio iniziale da Firestore:", error);
      await this.presentFF7Alert('Errore nel caricamento del profilo. Riprova più tardi.');
    } finally {
      this.profileEdit = { ...this.profile };
      this.isLoading = false; // Il caricamento generale del profilo è completo qui
    }
  }

  private subscribeToFollowCounts(userId: string) {
    if (this.followersCountSubscription) this.followersCountSubscription.unsubscribe();
    if (this.followingCountSubscription) this.followingCountSubscription.unsubscribe();

    let loadedCount = 0; // Contatore per sapere quando entrambe le sottoscrizioni sono complete

    this.followersCountSubscription = this.followService.getFollowersCount(userId).subscribe(count => {
      this.ngZone.run(() => {
        this.followersCount = count;
        loadedCount++;
        if (loadedCount === 2) {
          this.isLoadingStats = false; // Entrambe le statistiche sono state caricate
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
          this.isLoadingStats = false; // Entrambe le statistiche sono state caricate
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
      bio: this.profileEdit.bio || ''
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
    }
    this.avatarMarginTop = '-60px';
  }

  // --- NUOVI METODI DI NAVIGAZIONE ---
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
  // --- FINE NUOVI METODI DI NAVIGAZIONE ---

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
    this.profileEdit.banner = '';
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
    this.profileEdit.photo = '';
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
  }


}
