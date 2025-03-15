import { Component } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-fotocamera',
  templateUrl: './fotocamera.page.html',
  styleUrls: ['./fotocamera.page.scss'],
  standalone: false,
})
export class FotocameraPage {
  photos: { src: string; lat?: number; lng?: number }[] = [];
  currentPage = 1;
  itemsPerPage = 15;
  zoomedPhoto: string | null = null;

  constructor() {}

  async takePhoto() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      // Creazione di un canvas per catturare l'immagine
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        console.error("Errore: impossibile ottenere il contesto del canvas.");
        return;
      }

      video.addEventListener("loadeddata", () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Converti l'immagine in base64 e salvala nella lista delle foto
        const photo = canvas.toDataURL("image/png");
        this.photos.push({ src: photo });

        // Ferma lo stream video
        stream.getTracks().forEach(track => track.stop());
      });
    } catch (error) {
      console.error("Errore nell'acquisizione della fotocamera:", error);
    }
  }



  takePhotoBrowser() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Suggerisce la fotocamera posteriore su mobile
    input.click();

    input.onchange = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        this.photos.push({ src: reader.result as string });
      };
      reader.readAsDataURL(file);
    };
  }

  isBrowser(): boolean {
    return !Capacitor.isNativePlatform();
  }

  deletePhoto(photo: { src: string; lat?: number; lng?: number }) {
    this.photos = this.photos.filter((p) => p !== photo);
  }

  totalPages(): number {
    return Math.ceil(this.photos.length / this.itemsPerPage);
  }

  getCurrentPagePhotos(): { src: string; lat?: number; lng?: number }[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.photos.slice(startIndex, startIndex + this.itemsPerPage);
  }

  paginationRange(): number[] {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  changePage(page: number) {
    this.currentPage = page;
  }

  nextPage() {
    if (this.currentPage < this.totalPages()) {
      this.currentPage++;
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  getCurrentPageRows(): { src: string; lat?: number; lng?: number }[][] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const pagePhotos = this.photos.slice(startIndex, startIndex + this.itemsPerPage);
    const rows: { src: string; lat?: number; lng?: number }[][] = [];
    for (let i = 0; i < pagePhotos.length; i += 5) {
      rows.push(pagePhotos.slice(i, i + 5));
    }
    return rows;
  }

  zoomPhoto(photo: string) {
    this.zoomedPhoto = photo;
  }

  closeZoom() {
    this.zoomedPhoto = null;
  }
}
