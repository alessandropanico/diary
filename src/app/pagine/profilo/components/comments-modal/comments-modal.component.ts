// src/app/componenti/comments-modal/comments-modal.component.ts
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular'; // ⭐ Importa ModalController ⭐

import { CommentSectionComponent } from '../comment-section/comment-section.component';

@Component({
  selector: 'app-comments-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, CommentSectionComponent],
  templateUrl: './comments-modal.component.html',
  styleUrls: ['./comments-modal.component.scss']
})
export class CommentsModalComponent implements OnInit, OnDestroy {
  @Input() postId!: string;
  @Input() postCreatorAvatar: string | undefined;
  @Input() postCreatorUsername: string | undefined;
  @Input() postText: string | undefined;
  @Output() closeModalEvent = new EventEmitter<void>(); // Puoi ancora usarlo se vuoi emettere un evento

  // ⭐ Iniettiamo ModalController ⭐
  constructor(private modalController: ModalController) { }

  ngOnInit(): void {
    // ⭐ RIMUOVI QUESTE RIGHE: Ionic gestisce lo scroll del body automaticamente ⭐
    // document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    // ⭐ RIMUOVI QUESTE RIGHE: Ionic gestisce lo scroll del body automaticamente ⭐
    // document.body.style.overflow = 'auto';
  }

  closeModal(): void {
    this.modalController.dismiss(); // ⭐ Usa il metodo dismiss di Ionic ⭐
    // Puoi ancora emettere l'evento se altri componenti ci sono in ascolto
    this.closeModalEvent.emit();
  }
}
