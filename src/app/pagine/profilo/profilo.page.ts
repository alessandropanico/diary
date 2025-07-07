import { Component, OnInit, NgZone } from '@angular/core';
import { AlertController } from '@ionic/angular';

import { UserDataService } from 'src/app/services/user-data.service';
import { getAuth, User } from 'firebase/auth';

@Component({
  selector: 'app-profilo',
  templateUrl: './profilo.page.html',
  styleUrls: ['./profilo.page.scss'],
  standalone: false,
})
export class ProfiloPage implements OnInit {

  profile = {
    photo: '',
    nickname: '',
    name: '',
    email: '',
    bio: ''
  };

  profileEdit = {
    photo: '',
    nickname: '',
    name: '',
    email: '',
    bio: ''
  };

  editing = false;
  isLoading = true;

  constructor(
    private ngZone: NgZone,
    private alertCtrl: AlertController,
    private userDataService: UserDataService,
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    const loadProfileData = async (user: User) => {
      try {
        const firestoreData = await this.userDataService.getUserData();

        if (firestoreData) {
          this.profile = {
            photo: firestoreData.photo || user.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
            nickname: firestoreData.nickname || user.displayName?.split(' ')[0] || '',
            name: firestoreData.name || user.displayName || '',
            email: firestoreData.email || user.email || '',
            bio: firestoreData.bio || ''
          };
        } else {
          this.profile = {
            photo: user.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
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
      }
    };

    let attempts = 0;
    const maxAttempts = 20;
    const intervalTime = 200;

    const checkUserAndLoad = () => {
      const currentUser = getAuth().currentUser;

      if (currentUser) {
        loadProfileData(currentUser)
          .then(() => {
            this.profileEdit = { ...this.profile };
            this.isLoading = false;
          })
          .catch(() => {
            this.isLoading = false;
            console.error("Errore finale nel caricamento dati dopo che l'utente era disponibile.");
          });
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkUserAndLoad, intervalTime);
      } else {
        console.warn("ngOnInit: Utente non loggato dopo il massimo dei tentativi. Resetting profile data.");
        this.profile = { photo: '', nickname: '', name: '', email: '', bio: '' };
        this.profileEdit = { ...this.profile };
        this.isLoading = false;
        this.presentFF7Alert('Impossibile caricare il profilo. Assicurati di essere loggato.');
      }
    };

    checkUserAndLoad();
  }


  startEdit() {
    this.editing = true;
    this.profileEdit = { ...this.profile };
  }


  cancelEdit() {
    this.editing = false;
    this.profileEdit = { ...this.profile };
  }

  async saveProfile() {
    this.isLoading = true;

    this.profile = {
      photo: this.profileEdit.photo,
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

  changePhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = () => {
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.ngZone.run(() => {
            const photoData = e.target.result;
            this.profileEdit.photo = photoData;
          });
        };
        reader.readAsDataURL(input.files[0]);
      }
    };
    input.click();
  }

  removePhoto() {
    this.profileEdit.photo = '';
  }

}
