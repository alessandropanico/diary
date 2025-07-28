import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';

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
  @Output() closeModalEvent = new EventEmitter<void>();

  constructor(private modalController: ModalController) { }

  ngOnInit(): void {
    // document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    // ⭐ RIMUOVI QUESTE RIGHE: Ionic gestisce lo scroll del body automaticamente ⭐
    // document.body.style.overflow = 'auto';
  }

  closeModal(): void {
    this.modalController.dismiss();
    this.closeModalEvent.emit();
  }
}
