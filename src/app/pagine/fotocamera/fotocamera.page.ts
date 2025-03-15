import { Component, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';
import { PhotoService } from 'src/app/services/photo.service';

@Component({
  selector: 'app-fotocamera',
  templateUrl: './fotocamera.page.html',
  styleUrls: ['./fotocamera.page.scss'],
  standalone: false,
})
export class FotocameraPage implements AfterViewInit, OnInit {
  @ViewChild('video', { static: false }) videoElement!: ElementRef;
  previewActive = false;
  stream: MediaStream | null = null;

  constructor(private photoService: PhotoService) {}

  ngOnInit() {}

  ngAfterViewInit() {}

  async startCamera() {
    try {
      this.previewActive = true;
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.videoElement.nativeElement.srcObject = this.stream;
    } catch (error) {
      console.error('Errore nell’aprire la fotocamera:', error);
      alert('Impossibile accedere alla fotocamera.');
      this.previewActive = false;
    }
  }

  async takePhoto() {
    if (!this.videoElement || !this.videoElement.nativeElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/png');
    this.photoService.addPhoto(imageData); // Usa il servizio per salvare la foto

    this.stopCamera();
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.previewActive = false;
  }
}
