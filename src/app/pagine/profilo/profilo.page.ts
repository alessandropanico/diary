import { Component, OnInit } from '@angular/core';
import { NgZone } from '@angular/core';
import { AlertController } from '@ionic/angular';

import { UserDataService } from 'src/app/services/user-data.service';
import { getAuth } from 'firebase/auth';

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

  constructor(
    private ngZone: NgZone,
    private alertCtrl: AlertController,
    private userDataService: UserDataService,
  ) { }

async ngOnInit() { // Rendiamo ngOnInit asincrono
    const currentUser = getAuth().currentUser; // Ottieni l'utente Firebase attualmente loggato

    if (currentUser) {
      // 1. Prova a caricare i dati da Firestore
      const firestoreData = await this.userDataService.getUserData();

      if (firestoreData) {
        // Se i dati esistono su Firestore, usali
        this.profile = {
          photo: firestoreData.photo || currentUser.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
          nickname: firestoreData.nickname || currentUser.displayName?.split(' ')[0] || '',
          name: firestoreData.name || currentUser.displayName || '',
          email: firestoreData.email || currentUser.email || '',
          bio: firestoreData.bio || ''
        };
      } else {
        // Se non ci sono dati su Firestore, usa i dati di base dell'utente di Firebase Auth
        this.profile = {
          photo: currentUser.photoURL || 'assets/immaginiGenerali/default-avatar.jpg',
          nickname: currentUser.displayName?.split(' ')[0] || '', // Prendi solo la prima parte del nome
          name: currentUser.displayName || '',
          email: currentUser.email || '',
          bio: ''
        };
        // E potresti voler salvare questi dati iniziali su Firestore la prima volta
        await this.userDataService.saveUserData(this.profile);
      }
    } else {
      // Caso limite: nessun utente loggato. Potresti reindirizzare al login.
      console.warn("Nessun utente loggato sulla pagina profilo.");
      // Optional: window.location.href = '/login';
    }

    // Inizializza profileEdit con i dati attuali del profilo
    this.profileEdit = { ...this.profile };
  }


 startEdit() {
  this.editing = true;

  this.profileEdit = {
    photo: this.profile.photo,
    nickname: this.profile.nickname,
    name: this.profile.name,
    email: this.profile.email,
    bio: this.profile.bio
  };
}


  cancelEdit() {
    this.editing = false;

    // Ripulisci il form
    this.profileEdit = {
      photo: '',
      nickname: '',
      name: '',
      email: '',
      bio: ''
    };
  }

async saveProfile() {
  // Prima aggiorniamo il 'profile' locale con i dati del 'profileEdit'
  this.profile = {
    photo: this.profileEdit.photo,
    nickname: this.profileEdit.nickname || '',
    name: this.profileEdit.name || '',
    email: this.profileEdit.email || '', // L'email di solito non si modifica qui, ma la teniamo per completezza
    bio: this.profileEdit.bio || ''
  };

  // Salva i dati aggiornati su Firestore tramite il servizio
  await this.userDataService.saveUserData(this.profile);

  // Non è più strettamente necessario salvare su localStorage se Firestore è la fonte di verità,
  // ma puoi mantenerlo come cache se preferisci.
  // localStorage.setItem('profile', JSON.stringify(this.profile));

  this.editing = false;

  // Ripristina profileEdit per essere pronto per la prossima modifica
  this.profileEdit = { ...this.profile };

  await this.presentFF7Alert('Profilo aggiornato e salvato!');
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
