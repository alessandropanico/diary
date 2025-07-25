import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Comment } from 'src/app/interfaces/comment';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'; 

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
  @Output() goToProfile = new EventEmitter<string>();

  formattedCommentText: SafeHtml | undefined;

  constructor(private cdr: ChangeDetectorRef, private sanitizer: DomSanitizer) { }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['comment'] || changes['currentUserId'] || changes['nestingLevel']) {
      this.formattedCommentText = this.formatTextWithUserTags(this.comment.text);
      this.cdr.detectChanges();
    }
  }

  /**
   * ⭐ NUOVO METODO: Formatta il testo del commento, trasformando i tag @nickname in link cliccabili.
   * Il data-identifier conterrà il nickname.
   * @param text Il testo grezzo del commento.
   * @returns SafeHtml Il testo formattato come HTML sicuro.
   */
  private formatTextWithUserTags(text: string): SafeHtml {
    const tagRegex = /@([a-zA-Z0-9_.-]+)/g;

    const replacedText = text.replace(tagRegex, (match, nickname) => {
      return `<a class="user-tag" data-identifier="${nickname}">${match}</a>`;
    });

    // Usa DomSanitizer per marcare l'HTML come sicuro.
    return this.sanitizer.bypassSecurityTrustHtml(replacedText);
  }

  /**
   * ⭐ NUOVO METODO: Gestisce il click sul testo del commento, in particolare sui link dei tag utente.
   * Emette l'identifier (nickname) al componente padre.
   * @param event L'evento click.
   */
  onCommentTextClick(event: Event) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('user-tag')) {
      event.preventDefault();
      event.stopPropagation();

      const identifier = target.dataset['identifier'];
      if (identifier) {
        this.goToProfile.emit(identifier);
      }
    }
  }

  onToggleLike() {
    this.toggleLike.emit(this.comment);
  }

  onSetReply() {
    this.setReply.emit(this.comment);
  }

  onDeleteComment() {
    this.deleteComment.emit(this.comment.id);
  }

  propagateDeleteComment(commentId: string) {
    this.deleteComment.emit(commentId);
  }

  onGoToProfile() {
    this.goToProfile.emit(this.comment.userId);
  }

  propagateToggleLike(commentToToggle: Comment) {
    this.toggleLike.emit(commentToToggle);
  }

  propagateGoToProfile(identifier: string) {
    this.goToProfile.emit(identifier);
  }
}
