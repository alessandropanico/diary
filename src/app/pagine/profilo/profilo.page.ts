import { Component, OnInit, NgZone, OnDestroy } from '@angular/core'; // Aggiunto OnDestroy
import { AlertController } from '@ionic/angular';
import { UserDataService } from 'src/app/services/user-data.service';
import { FollowService } from 'src/app/services/follow.service'; // Importa il nuovo servizio
import { getAuth, User, onAuthStateChanged } from 'firebase/auth'; // Aggiunto onAuthStateChanged
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Subscription } from 'rxjs'; // Importa Subscription

@Component({
  selector: 'app-profilo',
  templateUrl: './profilo.page.html',
  styleUrls: ['./profilo.page.scss'],
  standalone: false,
})
export class ProfiloPage implements OnInit, OnDestroy { // Implementa OnDestroy

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

  loggedInUserId: string | null = null; // Aggiungi questa proprietà per l'ID dell'utente loggato
  followersCount = 0; // Contatore per i follower
  followingCount = 0; // Contatore per le persone che segui

  private authStateUnsubscribe: (() => void) | undefined; // Per disiscriversi dall'auth state listener
  private followersCountSubscription: Subscription | undefined; // Per disiscriversi dal conteggio follower
  private followingCountSubscription: Subscription | undefined; // Per disiscriversi dal conteggio following

  constructor(
    private ngZone: NgZone,
    private alertCtrl: AlertController,
    private userDataService: UserDataService,
    private followService: FollowService, // Inietta il FollowService
  ) { }

  async ngOnInit() {
    this.isLoading = true;

    // Ascolta lo stato di autenticazione per ottenere l'ID dell'utente loggato
    const auth = getAuth();
    this.authStateUnsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      this.ngZone.run(async () => { // Assicurati che gli aggiornamenti UI siano nel contesto di Angular
        if (user) {
          this.loggedInUserId = user.uid;
          console.log('ProfiloPage: Utente loggato ID:', this.loggedInUserId);
          await this.loadProfileData(user); // Carica i dati del profilo
          this.subscribeToFollowCounts(user.uid); // Sottoscrivi ai conteggi di follow
        } else {
          this.loggedInUserId = null;
          this.profile = { photo: '', banner: '', nickname: '', name: '', email: '', bio: '' };
          this.profileEdit = { ...this.profile };
          this.isLoading = false;
          console.warn('ProfiloPage: Nessun utente loggato.');
          // Potresti voler reindirizzare l'utente se non è loggato
          // this.router.navigateByUrl('/login');
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
        await this.userDataService.saveUserData(this.profile); // Salva i dati iniziali su Firestore
      }
    } catch (error) {
      console.error("Errore durante il caricamento/salvataggio iniziale da Firestore:", error);
      await this.presentFF7Alert('Errore nel caricamento del profilo. Riprova più tardi.');
    } finally {
      this.profileEdit = { ...this.profile };
      this.isLoading = false;
    }
  }

  // Nuovo metodo per sottoscrivere ai conteggi di follow
  private subscribeToFollowCounts(userId: string) {
    if (this.followersCountSubscription) this.followersCountSubscription.unsubscribe();
    if (this.followingCountSubscription) this.followingCountSubscription.unsubscribe();

    this.followersCountSubscription = this.followService.getFollowersCount(userId).subscribe(count => {
      this.ngZone.run(() => {
        this.followersCount = count;
        console.log(`I tuoi follower:`, this.followersCount);
      });
    });

    this.followingCountSubscription = this.followService.getFollowingCount(userId).subscribe(count => {
      this.ngZone.run(() => {
        this.followingCount = count;
        console.log(`Persone che segui:`, this.followingCount);
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

  // Implementa OnDestroy per pulire le sottoscrizioni
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
