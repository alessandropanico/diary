import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommentSectionComponent } from '../comment-section/comment-section.component';
// Non hai bisogno di importare 'Post' qui dato che passi singole proprietà
// import { Post } from 'src/app/interfaces/post';

@Component({
  selector: 'app-comments-modal',
  standalone: true,
  imports: [CommonModule, CommentSectionComponent],
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
