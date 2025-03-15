import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  private PHOTO_STORAGE_KEY = 'savedPhotos';

  constructor() {}

  // Recupera le foto dal localStorage
  getPhotos(): { src: string }[] {
    const savedPhotos = localStorage.getItem(this.PHOTO_STORAGE_KEY);
    return savedPhotos ? JSON.parse(savedPhotos) : [];
  }

  // Salva una nuova foto
  addPhoto(photoSrc: string) {
    const photos = this.getPhotos();
    photos.push({ src: photoSrc });
    localStorage.setItem(this.PHOTO_STORAGE_KEY, JSON.stringify(photos));
  }

  // Elimina una foto specifica
  deletePhoto(photo: { src: string }) {
    let photos = this.getPhotos();
    photos = photos.filter(p => p.src !== photo.src);
    localStorage.setItem(this.PHOTO_STORAGE_KEY, JSON.stringify(photos));
  }
}
