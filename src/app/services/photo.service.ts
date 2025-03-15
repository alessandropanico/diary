import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PhotoService {
  private photos: { src: string }[] = [];

  constructor() {
    this.loadPhotos();
  }

  // Carica le foto dal localStorage
  private loadPhotos() {
    const savedPhotos = localStorage.getItem('savedPhotos');
    if (savedPhotos) {
      this.photos = JSON.parse(savedPhotos);
    }
  }

  // Salva le foto nel localStorage
  private savePhotos() {
    localStorage.setItem('savedPhotos', JSON.stringify(this.photos));
  }

  // Ottiene tutte le foto
  getPhotos(): { src: string }[] {
    return this.photos;
  }

  // Aggiunge una nuova foto
  addPhoto(photo: string) {
    this.photos.push({ src: photo });
    this.savePhotos();
  }

  // Elimina una foto
  deletePhoto(photo: { src: string }) {
    this.photos = this.photos.filter(p => p !== photo);
    this.savePhotos();
  }
}
