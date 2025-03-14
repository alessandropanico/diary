import { Component } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';


@Component({
  selector: 'app-fotocamera',
  templateUrl: './fotocamera.page.html',
  styleUrls: ['./fotocamera.page.scss'],
  standalone: false,

})
export class FotocameraPage {
  photos: { src: string, lat?: number, lng?: number }[] = [];
  currentPage = 1;
  itemsPerPage = 15;
  zoomedPhoto: string | null = null;

  constructor() {
  }

  async takePhoto() {
    console.log('Taking photo...');
    try {
      const image = await Camera.getPhoto({
        quality: 100,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: true,
      });

      console.log('Photo taken:', image);

      const position = await Geolocation.getCurrentPosition();
      console.log('Current position:', position);

      this.photos.push({
        src: image.dataUrl ?? '',
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });


    } catch (error) {
      console.error('Error taking photo or getting location', error);

      if (error === 'Permission denied') {
        console.error('Permission denied by user');
      }
    }
  }

  deletePhoto(photo: { src: string, lat?: number, lng?: number }) {
    this.photos = this.photos.filter(p => p !== photo);
  }

  totalPages(): number {
    return Math.ceil(this.photos.length / this.itemsPerPage);
  }

  getCurrentPagePhotos(): { src: string, lat?: number, lng?: number }[] {
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

  getCurrentPageRows(): { src: string, lat?: number, lng?: number }[][] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const pagePhotos = this.photos.slice(startIndex, startIndex + this.itemsPerPage);
    const rows: { src: string, lat?: number, lng?: number }[][] = [];
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
