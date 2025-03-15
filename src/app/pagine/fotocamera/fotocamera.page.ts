import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-fotocamera',
  templateUrl: './fotocamera.page.html',
  styleUrls: ['./fotocamera.page.scss'],
  standalone: false,
})
export class FotocameraPage implements AfterViewInit {
  @ViewChild('video', { static: false }) videoElement!: ElementRef;
  photos: { src: string; lat?: number; lng?: number }[] = [];
  photo: string | null = null; // Per la foto scattata
  currentPage = 1;
  itemsPerPage = 15;
  zoomedPhoto: string | null = null;
  stream: MediaStream | null = null;

  constructor() { }

  ngAfterViewInit() {
    this.startCamera();
  }

  // Avvia la fotocamera per l'anteprima
  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.videoElement.nativeElement.srcObject = this.stream;
    } catch (error) {
      console.error("Errore nell'aprire la fotocamera:", error);
    }
  }

  // Scatta la foto
  async takePhoto() {
    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      console.error("Errore: impossibile ottenere il contesto del canvas.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    this.photo = canvas.toDataURL('image/png');

    // Ferma il flusso video dopo lo scatto
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }

  // Funzione per scattare foto dal browser (se non è un'app nativa)
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

  // Funzione per cancellare una foto
  deletePhoto(photo: { src: string; lat?: number; lng?: number }) {
    this.photos = this.photos.filter((p) => p !== photo);
  }

  // Funzione per navigare tra le pagine delle foto
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
