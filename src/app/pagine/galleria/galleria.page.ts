import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { PhotoService } from 'src/app/services/photo.service';

interface Photo {
  id: number;
  src: string;
}

@Component({
  selector: 'app-galleria',
  templateUrl: './galleria.page.html',
  styleUrls: ['./galleria.page.scss'],
  standalone: false,
})
export class GalleriaPage implements OnInit {

  constructor(private photoService: PhotoService) { }

  @ViewChild('video', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  photos: Photo[] = [];
  previewActive = false;
  stream: MediaStream | null = null;

  lightboxOpen = false;
  selectedPhotoIndex = 0;

  confirmDeletePhoto: Photo | null = null;
  isLoading = true;
  cameraFacing: 'user' | 'environment' = 'environment';

  // Getter per foto selezionata (lightbox)
  get selectedPhoto(): string {
    return this.photos[this.selectedPhotoIndex]?.src || '';
  }

  ngOnInit() {
    this.loadPhotos();
  }



  async loadPhotos() {
    this.isLoading = true;
    try {
      this.photos = await this.photoService.getPhotos();
    } catch (error) {
      console.error('Errore caricamento foto', error);
    } finally {
      this.isLoading = false;
    }
  }


  // Fotocamera
  async startCamera() {
    try {
      this.previewActive = true;

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: this.cameraFacing }
        }

      });

      this.videoElement.nativeElement.srcObject = this.stream;
    } catch (error) {
      console.error('Errore nella fotocamera:', error);
      alert('Impossibile avviare la fotocamera.');
      this.previewActive = false;
    }
  }

  isMobile(): boolean {
    return /Mobi|Android/i.test(navigator.userAgent);
  }

  async toggleCamera() {
    this.stopCamera();
    this.cameraFacing = this.cameraFacing === 'user' ? 'environment' : 'user';
    await this.startCamera();
  }


  async takePhoto() {
    const video = this.videoElement?.nativeElement;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context || !video) return;

    // Riduzione dimensioni e compressione
    canvas.width = video.videoWidth / 2;
    canvas.height = video.videoHeight / 2;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (blob) {
        await this.photoService.addPhoto(blob);
        await this.loadPhotos();
        this.stopCamera();
      }
    }, 'image/jpeg', 0.7);
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.previewActive = false;
  }

  // Lightbox
  openLightbox(photoSrc: string) {
    const index = this.photos.findIndex(p => p.src === photoSrc);
    if (index >= 0) {
      this.selectedPhotoIndex = index;
      this.lightboxOpen = true;
    }
  }

  closeLightbox() {
    this.lightboxOpen = false;
  }

  prevPhoto(event: Event) {
    event.stopPropagation();
    if (this.selectedPhotoIndex > 0) {
      this.selectedPhotoIndex--;
    }
  }

  nextPhoto(event: Event) {
    event.stopPropagation();
    if (this.selectedPhotoIndex < this.photos.length - 1) {
      this.selectedPhotoIndex++;
    }
  }

  // Eliminazione
  askDelete(photo: Photo) {
    this.confirmDeletePhoto = photo;
  }

  async confirmDelete() {
    if (this.confirmDeletePhoto) {
      await this.photoService.deletePhoto(this.confirmDeletePhoto.id);
      await this.loadPhotos();
      this.confirmDeletePhoto = null;
    }
  }

  cancelDelete() {
    this.confirmDeletePhoto = null;
  }

  async deletePhoto(photo: Photo) {
    await this.photoService.deletePhoto(photo.id);
    await this.loadPhotos();
  }

  // Condivisione
  async sharePhoto(photoSrc: string) {
    try {
      const response = await fetch(photoSrc);
      const blob = await response.blob();
      const file = new File([blob], 'foto.jpg', { type: blob.type });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Condividi foto',
          text: 'Guarda questa foto!',
        });
      } else {
        alert('La condivisione file non è supportata su questo dispositivo.');
      }
    } catch (error) {
      console.error('Errore nella condivisione:', error);
      alert('Errore durante la condivisione della foto.');
    }
  }

}
