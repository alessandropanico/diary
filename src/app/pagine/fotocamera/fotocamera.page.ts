import { Component } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-fotocamera',
  templateUrl: './fotocamera.page.html',
  styleUrls: ['./fotocamera.page.scss'],
  standalone: false,
})
export class FotocameraPage {
  photo: string | undefined; // Per salvare il percorso della foto

  constructor(private platform: Platform) {}

  async capturePhoto() {
    // Controlla se l'app è in esecuzione su un dispositivo mobile
    if (this.platform.is('mobile')) {
      try {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera, // FORZA L'USO DELLA FOTOCAMERA
          saveToGallery: true // Opzionale: salva la foto nella galleria
        });

        this.photo = image.webPath; // Mostra l'immagine nell'interfaccia
      } catch (error) {
        console.error('Errore durante lo scatto della foto:', error);
      }
    } else {
      console.log('La fotocamera non è disponibile su PC, prova su un dispositivo mobile.');
    }
  }
}
