// src/app/components/comments-modal/comments-modal.component.ts

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { CommentSectionComponent } from '../comment-section/comment-section.component';
import { Router } from '@angular/router';
import { getAuth } from 'firebase/auth'; // ⭐ Importa getAuth per ottenere l'utente corrente ⭐

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

  private currentUserId: string | null = null; // ⭐ Aggiungi una proprietà per l'ID utente corrente ⭐

  constructor(
    private modalController: ModalController,
    private router: Router
  ) { }

  ngOnInit(): void {
    // ⭐ Ottieni l'ID dell'utente corrente all'inizializzazione ⭐
    const auth = getAuth();
    if (auth.currentUser) {
      this.currentUserId = auth.currentUser.uid;
    }
  }

  ngOnDestroy(): void {
    // Nessuna modifica necessaria qui.
  }

  closeModal(): void {
    this.modalController.dismiss();
    this.closeModalEvent.emit();
  }

  /**
   * Gestisce l'evento di navigazione al profilo utente.
   * Chiude il modale e poi naviga alla pagina del profilo specificata dall'UID.
   * Se l'utente è quello corrente, naviga a '/profilo', altrimenti a '/profilo-altri-utenti/{id}'.
   * @param userId L'ID dell'utente al cui profilo navigare.
   */
  async handleGoToUserProfile(userId: string) {

    // 1. Chiudi il modale corrente
    await this.modalController.dismiss();
    this.closeModalEvent.emit();

    // 2. Naviga al profilo utente
    if (userId) {
      if (userId === this.currentUserId) {
        // Se l'UID corrisponde all'utente loggato, naviga alla pagina del proprio profilo
        this.router.navigateByUrl('/profilo');
      } else {
        // Altrimenti, naviga alla pagina del profilo di altri utenti
        this.router.navigate(['/profilo-altri-utenti', userId]);
      }
    } else {
      console.warn('CommentsModalComponent: Tentativo di navigare a un profilo utente con UID nullo o indefinito.');
      // Puoi decidere di navigare a una pagina predefinita, mostrare un alert, ecc.
    }
  }
}
