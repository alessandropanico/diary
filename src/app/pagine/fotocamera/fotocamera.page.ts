import { Component, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';

@Component({
  selector: 'app-fotocamera',
  templateUrl: './fotocamera.page.html',
  styleUrls: ['./fotocamera.page.scss'],
  standalone: false,
})
export class FotocameraPage implements AfterViewInit, OnInit {
  @ViewChild('video', { static: false }) videoElement!: ElementRef;
  photos: { src: string }[] = [];
  photo: string | null = null;
  stream: MediaStream | null = null;
  previewActive = false; // Controlla se l'anteprima è attiva

  constructor() {}

  ngOnInit() {
    this.loadPhotos();
  }

  ngAfterViewInit() {}

  // Avvia l'anteprima della fotocamera
  async startCamera() {
    try {
      this.previewActive = true; // Mostra l'anteprima
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.videoElement.nativeElement.srcObject = this.stream;
    } catch (error) {
      console.error('Errore nell’aprire la fotocamera:', error);
      alert('Impossibile accedere alla fotocamera.');
      this.previewActive = false;
    }
  }

  // Scatta la foto
  async takePhoto() {
    if (!this.videoElement || !this.videoElement.nativeElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('Errore: impossibile ottenere il contesto del canvas.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/png');
    this.photo = imageData;

    // Salva la foto in localStorage
    this.photos.push({ src: imageData });
    this.savePhotos();

    // Ferma l'anteprima dopo lo scatto
    this.stopCamera();
  }

  // Ferma la fotocamera
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.previewActive = false;
  }

  // Carica le foto salvate in localStorage
  loadPhotos() {
    const savedPhotos = localStorage.getItem('savedPhotos');
    if (savedPhotos) {
      this.photos = JSON.parse(savedPhotos);
    }
  }

  // Salva le foto in localStorage
  savePhotos() {
    localStorage.setItem('savedPhotos', JSON.stringify(this.photos));
  }

  // Elimina una foto
  deletePhoto(photo: { src: string }) {
    this.photos = this.photos.filter(p => p !== photo);
    this.savePhotos();
  }

  // Per caricare una foto dal file system su browser
  takePhotoBrowser() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.click();

    input.onchange = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        this.photos.push({ src: reader.result as string });
        this.savePhotos();
      };
      reader.readAsDataURL(file);
    };
  }
}
