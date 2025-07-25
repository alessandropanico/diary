import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Comment } from 'src/app/interfaces/comment';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-comment-item',
  templateUrl: './comment-item.component.html',
  styleUrls: ['./comment-item.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommentItemComponent implements OnInit, OnChanges {

  @Input() comment!: Comment;
  @Input() currentUserId: string | null = null;
  @Input() nestingLevel: number = 0;
  @Input() formatCommentTime!: (timestamp: string) => string;

  @Output() toggleLike = new EventEmitter<Comment>();
  @Output() setReply = new EventEmitter<Comment>();
  @Output() deleteComment = new EventEmitter<string>();
  @Output() goToProfile = new EventEmitter<string>(); // EventEmitter per la navigazione del profilo

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    // console.log(`CommentItemComponent Init: ID=${this.comment.id}, ParentID=${this.comment.parentId}, Level=${this.nestingLevel}`);
  }

  onToggleLike() {
    this.toggleLike.emit(this.comment);
  }

  onSetReply() {
    this.setReply.emit(this.comment);
  }

  onDeleteComment() {
    console.log(`CommentItemComponent: Eliminazione richiesta per ID: ${this.comment.id} (Level: ${this.nestingLevel})`);
    this.deleteComment.emit(this.comment.id);
  }

  propagateDeleteComment(commentId: string) {
    console.log(`CommentItemComponent: Propagazione eliminazione per ID: ${commentId} (da un figlio, Level: ${this.nestingLevel})`);
    this.deleteComment.emit(commentId);
  }

  // Questo metodo viene chiamato quando si clicca sull'avatar o username di QUESTO commento.
  // Emette l'ID dell'utente associato a QUESTO commento al componente padre.
  onGoToProfile() {
    console.log(`CommentItemComponent: Richiesta go to profile per User ID: ${this.comment.userId} (Comment ID: ${this.comment.id}, Level: ${this.nestingLevel})`);
    this.goToProfile.emit(this.comment.userId);
  }

  // NUOVO METODO: Propaga l'evento toggleLike dai commenti figli al commento padre.
  // Questo assicura che il commento corretto venga propagato.
  propagateToggleLike(commentToToggle: Comment) {
    // console.log(`CommentItemComponent (livello ${this.nestingLevel}): Propagazione like per ID: ${commentToToggle.id}`);
    this.toggleLike.emit(commentToToggle);
  }

  // Questo nuovo metodo viene chiamato quando un componente app-comment-item figlio
  // (una risposta annidata) emette l'evento goToProfile. Serve a ri-emettere l'ID
  // dell'utente del figlio al componente genitore.
  propagateGoToProfile(userId: string) {
    console.log(`CommentItemComponent: Propagazione go to profile per User ID: ${userId} (da un figlio, Level: ${this.nestingLevel})`);
    this.goToProfile.emit(userId);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['comment'] || changes['currentUserId'] || changes['nestingLevel']) {
      this.cdr.detectChanges();
    }
  }
}
