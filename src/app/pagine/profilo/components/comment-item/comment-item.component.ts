import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Comment } from 'src/app/interfaces/comment';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'; // ⭐ Riaporta DomSanitizer

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
  // ⭐ L'EventEmitter goToProfile ora emette una stringa che può essere un UID o un nickname
  @Output() goToProfile = new EventEmitter<string>();

  // ⭐ Nuova proprietà per il testo del commento formattato con link
  formattedCommentText: SafeHtml | undefined;

  // ⭐ Inietta DomSanitizer nel costruttore
  constructor(private cdr: ChangeDetectorRef, private sanitizer: DomSanitizer) { }

  ngOnInit(): void {
    // console.log(`CommentItemComponent Init: ID=${this.comment.id}, ParentID=${this.comment.parentId}, Level=${this.nestingLevel}`);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['comment'] || changes['currentUserId'] || changes['nestingLevel']) {
      // ⭐ Riformatta il testo del commento ogni volta che il commento cambia
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
      // Qui l'identifier è il nickname stesso.
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
      event.preventDefault(); // Impedisce il comportamento predefinito del link
      event.stopPropagation(); // Blocca la propagazione dell'evento

      const identifier = target.dataset['identifier']; // Recupera l'identifier (nickname)
      if (identifier) {
        console.log(`CommentItemComponent: Click su tag @${identifier}. Emissione goToProfile.`);
        this.goToProfile.emit(identifier); // Emetti l'identifier (nickname) al componente padre
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
    this.goToProfile.emit(this.comment.userId); // Qui emettiamo l'UID del commento
  }


  // NUOVO METODO: Propaga l'evento toggleLike dai commenti figli al commento padre.
  // Questo assicura che il commento corretto venga propagato.
  propagateToggleLike(commentToToggle: Comment) {
    this.toggleLike.emit(commentToToggle);
  }

  // Questo nuovo metodo viene chiamato quando un componente app-comment-item figlio
  // (una risposta annidata) emette l'evento goToProfile. Serve a ri-emettere l'ID
  // dell'utente del figlio al componente genitore.
  // ⭐ Ora accetta 'identifier' (UID o nickname)
  propagateGoToProfile(identifier: string) {
    console.log(`CommentItemComponent: Propagazione go to profile per User ID/Nickname: ${identifier} (da un figlio, Level: ${this.nestingLevel})`);
    this.goToProfile.emit(identifier);
  }
}
