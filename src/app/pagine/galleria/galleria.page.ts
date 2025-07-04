import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { PhotoService } from 'src/app/services/photo.service';

@Component({
  selector: 'app-galleria',
  templateUrl: './galleria.page.html',
  styleUrls: ['./galleria.page.scss'],
  standalone: false,
})
export class GalleriaPage implements OnInit {

  constructor(private photoService: PhotoService) { }


  @ViewChild('video', { static: false }) videoElement!: ElementRef;
  photos: { src: string }[] = [];
  previewActive = false;
  stream: MediaStream | null = null;

  lightboxOpen = false;
  selectedPhotoIndex = 0;

  get selectedPhoto(): string {
    return this.photos[this.selectedPhotoIndex]?.src || '';
  }

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


  confirmDeletePhoto: { src: string } | null = null;

  askDelete(photo: { src: string }) {
    this.confirmDeletePhoto = photo;
  }

  confirmDelete() {
    if (this.confirmDeletePhoto) {
      this.photoService.deletePhoto(this.confirmDeletePhoto);
      this.loadPhotos();
      this.confirmDeletePhoto = null;
    }
  }

  cancelDelete() {
    this.confirmDeletePhoto = null;
  }

  ngOnInit() {
    this.loadPhotos();
  }

  loadPhotos() {
    this.photos = this.photoService.getPhotos();
  }

  deletePhoto(photo: { src: string }) {
    this.photoService.deletePhoto(photo);
    this.loadPhotos();
  }

  async startCamera() {
    try {
      this.previewActive = true;
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.videoElement.nativeElement.srcObject = this.stream;
    } catch (error) {
      console.error('Errore nella fotocamera:', error);
      alert('Impossibile avviare la fotocamera.');
      this.previewActive = false;
    }
  }

  async takePhoto() {
    const video = this.videoElement?.nativeElement;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/png');
    this.photoService.addPhoto(imageData);
    this.loadPhotos();
    this.stopCamera();
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.previewActive = false;
  }

  async sharePhoto(photoSrc: string) {
    try {
      const response = await fetch(photoSrc);
      const blob = await response.blob();

      const file = new File([blob], 'foto.jpg', { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
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
