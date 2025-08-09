// src/app/components/comments-modal/comments-modal.component.ts

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { CommentSectionComponent } from '../comment-section/comment-section.component';
import { Router } from '@angular/router';
import { getAuth } from 'firebase/auth';

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
  @Input() postCreatorId!: string; // ⭐ AGGIUNGI QUESTA PROPRIETÀ ⭐
  @Output() closeModalEvent = new EventEmitter<void>();

  private currentUserId: string | null = null;

  constructor(
    private modalController: ModalController,
    private router: Router
  ) { }

  ngOnInit(): void {
    const auth = getAuth();
    if (auth.currentUser) {
      this.currentUserId = auth.currentUser.uid;
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
}
