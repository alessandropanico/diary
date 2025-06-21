import { Component, OnInit } from '@angular/core';
import { NgZone } from '@angular/core';

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

  constructor(private ngZone: NgZone) { }

 ngOnInit() {
  const storedProfile = localStorage.getItem('profile') || localStorage.getItem('user');
  if (storedProfile) {
    const user = JSON.parse(storedProfile);

    this.profile = {
      photo: user.photo || user.picture || '',
      nickname: user.nickname || '',
      name: user.name || '',
      email: user.email || '',
      bio: user.bio || ''
    };
  }
}



  startEdit() {
    this.editing = true;

    // Form vuoto quando entri in modifica
    this.profileEdit = {
      photo: this.profile.photo,
      nickname: '',
      name: '',
      email: '',
      bio: ''
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

  saveProfile() {
    this.profile = {
      photo: this.profileEdit.photo, // accetta '' per rimuovere
      nickname: this.profileEdit.nickname || '',
      name: this.profileEdit.name || '',
      email: this.profileEdit.email || '',
      bio: this.profileEdit.bio || ''
    };

    localStorage.setItem('profile', JSON.stringify(this.profile));
    this.editing = false;

    // Svuota il form dopo salvataggio, ma tieni la foto sincronizzata
    this.profileEdit = {
      photo: this.profile.photo,
      nickname: '',
      name: '',
      email: '',
      bio: ''
    };

    alert('Profilo aggiornato!');
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
