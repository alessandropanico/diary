import { Component, OnInit } from '@angular/core';
import { PhotoService } from 'src/app/services/photo.service';

@Component({
  selector: 'app-galleria',
  templateUrl: './galleria.page.html',
  styleUrls: ['./galleria.page.scss'],
  standalone: false,
})

export class GalleriaPage implements OnInit {
  photos: { src: string }[] = [];

  constructor(private photoService: PhotoService) {}

  ngOnInit() {
    this.loadPhotos();
  }

  loadPhotos() {
    this.photos = this.photoService.getPhotos();
  }

  deletePhoto(photo: { src: string }) {
    this.photoService.deletePhoto(photo);
    this.loadPhotos(); // Aggiorna la galleria dopo l'eliminazione
  }
}
