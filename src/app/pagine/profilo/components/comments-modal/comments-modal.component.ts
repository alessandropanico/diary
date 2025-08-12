// src/app/components/comments-modal/comments-modal.component.ts

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { CommentSectionComponent } from '../comment-section/comment-section.component';
import { Router } from '@angular/router';
import { getAuth } from 'firebase/auth';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { UserDataService } from 'src/app/services/user-data.service'; // ⭐ NOVITÀ

export interface TagUser { // ⭐ NOVITÀ
  uid: string;
  nickname: string;
  fullName?: string;
  photo?: string;
  profilePictureUrl?: string;
}

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
  @Input() postCreatorId!: string;
  @Input() commentIdToHighlight: string | undefined;
  @Output() closeModalEvent = new EventEmitter<void>();

  private currentUserId: string | null = null;
  formattedPostText: SafeHtml | undefined; // ⭐ NOVITÀ

  constructor(
    private modalController: ModalController,
    private router: Router,
    private sanitizer: DomSanitizer, // ⭐ NOVITÀ
    private userDataService: UserDataService, // ⭐ NOVITÀ
    private cdr: ChangeDetectorRef // ⭐ NOVITÀ
  ) { }

  ngOnInit(): void {
    const auth = getAuth();
    if (auth.currentUser) {
      this.currentUserId = auth.currentUser.uid;
    }

    if (this.postText) {
      this.formattedPostText = this.formatPostContent(this.postText);
    }
  }

  ngOnDestroy(): void {
    // ...
  }

  closeModal(): void {
    this.modalController.dismiss();
    this.closeModalEvent.emit();
  }

  async handleGoToUserProfile(userId: string) {
    await this.modalController.dismiss();
    this.closeModalEvent.emit();

    if (userId) {
      if (userId === this.currentUserId) {
        this.router.navigateByUrl('/profilo');
      } else {
        this.router.navigate(['/profilo-altri-utenti', userId]);
      }
    } else {
      console.warn('CommentsModalComponent: Tentativo di navigare a un profilo utente con UID nullo o indefinito.');
    }
  }

  // ⭐ NOVITÀ: Metodo per formattare il testo con i link ai tag
  private formatPostContent(text: string): SafeHtml {
    const tagRegex = /@([a-zA-Z0-9_.-]+)/g;
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    const textWithTags = text.replace(tagRegex, (match, nickname) => {
      return `<a class="user-tag" data-identifier="${nickname}">${match}</a>`;
    });

    const formattedText = textWithTags.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="post-link">${url}</a>`);

    return this.sanitizer.bypassSecurityTrustHtml(formattedText);
  }

  // ⭐ NOVITÀ: Metodo per gestire il clic sui tag all'interno del testo del post
  async onPostTextClick(event: Event) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('user-tag')) {
      event.preventDefault();
      event.stopPropagation();
      const nickname = target.dataset['identifier'];
      if (nickname) {
        try {
          const users: TagUser[] = await this.userDataService.searchUsers(nickname);
          const taggedUser = users.find(u => u.nickname.toLowerCase() === nickname.toLowerCase());

          if (taggedUser) {
            this.handleGoToUserProfile(taggedUser.uid);
          } else {
            console.error(`Utente "${nickname}" non trovato.`);
          }
        } catch (error) {
          console.error('Errore durante la ricerca dell\'utente taggato:', error);
        }
      }
    }
  }
}
