import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { PhotoService } from 'src/app/services/photo.service';

@Component({
  selector: 'app-galleria',
  templateUrl: './galleria.page.html',
  styleUrls: ['./galleria.page.scss'],
  standalone: false,
})
export class GalleriaPage implements OnInit {
  @ViewChild('video', { static: false }) videoElement!: ElementRef;
  photos: { src: string }[] = [];
  previewActive = false;
  stream: MediaStream | null = null;

  constructor(private photoService: PhotoService) {}

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
}
