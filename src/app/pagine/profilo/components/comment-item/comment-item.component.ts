// src/app/components/comment-item/comment-item.component.ts
import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Comment } from 'src/app/interfaces/comment'; // Assicurati che il percorso sia corretto
import { FormsModule } from '@angular/forms'; // Necessario per il pulsante

@Component({
  selector: 'app-comment-item',
  templateUrl: './comment-item.component.html',
  styleUrls: ['./comment-item.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule], // Importa i moduli necessari
  changeDetection: ChangeDetectionStrategy.OnPush // Migliora le performance
})
export class CommentItemComponent {
  @Input() comment!: Comment;
  @Input() currentUserId: string | null = null;
  @Input() nestingLevel: number = 0; // Per gestire l'indentazione visiva
  @Input() formatCommentTime!: (timestamp: string) => string; // Funzione passata dal parent

  // Eventi da emettere al componente padre (CommentSectionComponent)
  @Output() toggleLike = new EventEmitter<Comment>();
  @Output() setReply = new EventEmitter<Comment>();
  @Output() deleteComment = new EventEmitter<string>();
  @Output() goToProfile = new EventEmitter<string>();

  constructor(private cdr: ChangeDetectorRef) {}

  // Metodi per emettere gli eventi
  onToggleLike() {
    this.toggleLike.emit(this.comment);
  }

  onSetReply() {
    this.setReply.emit(this.comment);
  }

  onDeleteComment() {
    this.deleteComment.emit(this.comment.id);
  }

  onGoToProfile() {
    this.goToProfile.emit(this.comment.userId);
  }

  // Questo è importante per rinfrescare il componente ricorsivo
  // quando l'input 'comment' cambia, specialmente se ChangeDetectionStrategy.OnPush è attivo.
  ngOnChanges() {
    this.cdr.detectChanges();
  }
}
