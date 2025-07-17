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
    status: 'neutral'
  };

  profileEdit = {
    photo: '',
    banner: '',
    nickname: '',
    name: '',
    email: '',
    bio: '',
    status: 'neutral'
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

  private userStatusSubscription: Subscription | undefined; // ⭐ NUOVO: Sottoscrizione per lo status


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
          this.profile = { photo: '', banner: '', nickname: '', name: '', email: '', bio: '', status: 'neutral' }; // ⭐ AGGIORNATO
          this.profileEdit = { ...this.profile };
          this.isLoading = false;
          this.isLoadingStats = false;
          console.warn('ProfiloPage: Nessun utente loggato.');
          // Puoi aggiungere qui un reindirizzamento se la pagina profilo richiede login obbligatorio
          // this.router.navigateByUrl('/login', { replaceUrl: true });
        }
      });
    });
  }

  // --- MODIFICA CHIAVE QUI ---
 async loadProfileData(user: User) {
    try {
      const firestoreData = await this.userDataService.getUserData(); // Leggi i dati da Firestore

      let initialProfileData: any = {};

      if (firestoreData) {
        // Se i dati esistono in Firestore, usali come base.
        initialProfileData = {
          photo: firestoreData.photo || user.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
          banner: firestoreData.banner || 'assets/immaginiGenerali/default-banner.jpg',
          nickname: firestoreData.nickname || user.displayName?.split(' ')[0] || '',
          name: firestoreData.name || user.displayName || '',
          email: firestoreData.email || user.email || '',
          bio: firestoreData.bio || '',
          status: firestoreData.status || 'neutral' // ⭐ NUOVO: Carica lo stato
        };
      } else {
        // Se non esistono dati in Firestore (primo accesso), usa i dati di Google come base.
        initialProfileData = {
          photo: user.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
          banner: 'assets/immaginiGenerali/default-banner.jpg',
          nickname: user.displayName?.split(' ')[0] || '',
          name: user.displayName || '',
          email: user.email || '',
          bio: '',
          status: 'neutral' // ⭐ NUOVO: Imposta stato di default per i nuovi utenti
        };
        // Salva i dati iniziali su Firestore per il prossimo accesso
        await this.userDataService.saveUserData(initialProfileData);
      }

      this.profile = { ...initialProfileData };
      this.profileEdit = { ...this.profile }; // Inizializza profileEdit con i dati caricati

    } catch (error) {
      console.error("Errore durante il caricamento/salvataggio iniziale da Firestore:", error);
      await this.presentFF7Alert('Errore nel caricamento del profilo. Riprova più tardi.');
      // In caso di errore grave, puoi anche decidere di reindirizzare o impostare valori di fallback puri
      this.profile = { photo: 'assets/immaginiGenerali/default-avatar.jpg', banner: 'assets/immaginiGenerali/default-banner.jpg', nickname: '', name: '', email: '', bio: '', status: 'neutral' }; // ⭐ AGGIORNATO
      this.profileEdit = { ...this.profile };
    } finally {
      this.isLoading = false; // Il caricamento generale del profilo è completo qui
    }
  }
  // --- FINE MODIFICA CHIAVE ---

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
        this.profile.status = status;
        // Se siamo in modalità modifica, aggiorna anche profileEdit.status
        // per mantenere la coerenza visiva nel picker emoji.
        if (this.editing) {
          this.profileEdit.status = status;
        }
      });
    });
  }

  startEdit() {
    this.editing = true;
    this.profileEdit = { ...this.profile }; // Clona i dati attuali del profilo per la modifica
    this.avatarMarginTop = '20px';
  }

  cancelEdit() {
    this.editing = false;
    this.profileEdit = { ...this.profile }; // Resetta profileEdit ai dati originali
    this.avatarMarginTop = '-60px';
  }

  async saveProfile() {
    this.isLoading = true; // Mostra lo spinner durante il salvataggio

    // Aggiorna l'oggetto 'profile' con i dati modificati
    this.profile = {
      photo: this.profileEdit.photo,
      banner: this.profileEdit.banner,
      nickname: this.profileEdit.nickname || '', // Assicura che non sia null o undefined
      name: this.profileEdit.name || '',
      email: this.profileEdit.email || '',
      bio: this.profileEdit.bio || '',
      status: this.profileEdit.status || 'neutral' // ⭐ NUOVO: Salva lo stato
    };

    try {
      await this.userDataService.saveUserData(this.profile); // Salva i dati aggiornati su Firestore
      await this.presentFF7Alert('Profilo aggiornato e salvato!');
    } catch (error) {
      console.error('Errore durante il salvataggio del profilo:', error);
      await this.presentFF7Alert('Errore durante il salvataggio del profilo.');
    } finally {
      this.editing = false; // Esci dalla modalità di modifica
      this.profileEdit = { ...this.profile }; // Sincronizza profileEdit con i dati appena salvati
      this.isLoading = false; // Nascondi lo spinner
      this.avatarMarginTop = '-60px'; // Riposiziona l'avatar
    }
  }

   // ⭐ NUOVO: Metodo per aggiornare lo status dal picker emoji
  onStatusSelected(newStatus: string) {
    this.ngZone.run(async () => {
      this.profileEdit.status = newStatus; // Aggiorna il valore nel modello di modifica
      // Non è necessario chiamare direttamente userDataService.updateUserStatus qui
      // perché verrà salvato quando chiami saveProfile().
      // Se volessi un salvataggio istantaneo, decommenteresti la riga sotto:
      // await this.userDataService.updateUserStatus(newStatus);
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
    this.profileEdit.banner = 'assets/immaginiGenerali/default-banner.jpg'; // Imposta il default per il prossimo salvataggio
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
    this.profileEdit.photo = 'assets/immaginiGenerali/default-avatar.jpg'; // Imposta il default per il prossimo salvataggio
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
