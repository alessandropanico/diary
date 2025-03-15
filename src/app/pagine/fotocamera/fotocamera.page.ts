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
      console.log('Trying to take a photo...');

      if (this.isBrowser()) {
        // Se siamo su browser, usa un input file
        this.takePhotoBrowser();
        return;
      }

      // Se siamo su un dispositivo mobile, usa Capacitor Camera
      const image = await Camera.getPhoto({
        quality: 100,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: true,
      });

      if (!image.dataUrl) {
        throw new Error('No image data received');
      }

      console.log('Photo taken:', image);

      const position = await Geolocation.getCurrentPosition();
      console.log('Current position:', position);

      this.photos.push({
        src: image.dataUrl,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });

    } catch (error: unknown) {
      console.error('Error taking photo:', error);
      alert('Errore nella fotocamera.');
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
