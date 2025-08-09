// src/app/components/comment-item/comment-item.component.ts

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
  @Input() commentIdToHighlight: string | undefined; // ⭐ NOVITÀ: Aggiunto l'input per l'ID da evidenziare

  @Output() toggleLike = new EventEmitter<Comment>();
  @Output() setReply = new EventEmitter<Comment>();
  @Output() deleteComment = new EventEmitter<string>();
  @Output() goToProfile = new EventEmitter<string>();
  @Output() viewLikes = new EventEmitter<Comment>();

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

  private formatTextWithUserTags(text: string): SafeHtml {
    const tagRegex = /@([a-zA-Z0-9_.-]+)/g;
    const replacedText = text.replace(tagRegex, (match, nickname) => {
      return `<a class="user-tag" data-identifier="${nickname}">${match}</a>`;
    });
    return this.sanitizer.bypassSecurityTrustHtml(replacedText);
  }

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

  onViewLikes() {
    this.viewLikes.emit(this.comment);
  }

  propagateViewLikes(comment: Comment) {
    this.viewLikes.emit(comment);
  }
}
