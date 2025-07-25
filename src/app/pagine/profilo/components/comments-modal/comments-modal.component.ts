import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
// Ho aggiunto FormsModule e IonicModule perché li avevi inclusi prima
// e CommentSectionComponent potrebbe dipendere da FormsModule per ngModel
// e IonicModule per eventuali componenti Ionic.
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { CommentSectionComponent } from '../comment-section/comment-section.component';
// Non hai bisogno di importare 'Post' qui dato che passi singole proprietà

@Component({
  selector: 'app-comments-modal',
  standalone: true,
  // Aggiunti FormsModule e IonicModule per consistenza con le tue importazioni precedenti
  imports: [CommonModule, FormsModule, IonicModule, CommentSectionComponent],
  templateUrl: './comments-modal.component.html',
  styleUrls: ['./comments-modal.component.scss']
})
export class CommentsModalComponent implements OnInit, OnDestroy {
  @Input() postId!: string; // L'ID del post è comunque obbligatorio

  // --- MODIFICATO: Rendi questi Input opzionali o di tipo 'string | undefined' ---
  @Input() postCreatorAvatar: string | undefined; // Ora accetta undefined
  @Input() postCreatorUsername: string | undefined; // Ora accetta undefined
  @Input() postText: string | undefined;           // Ora accetta undefined
  // ---------------------------------------------------------------------

  @Output() closeModalEvent = new EventEmitter<void>();

  constructor() { }

  ngOnInit(): void {
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    document.body.style.overflow = 'auto';
  }

  closeModal(): void {
    this.closeModalEvent.emit();
  }
}
