// src/app/components/notifications-modal/notifications-modal.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { NotificheService, Notifica } from 'src/app/services/notifiche.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { getAuth } from 'firebase/auth'; // ⭐⭐ NOVITÀ: Importa getAuth per ottenere l'ID utente corrente

@Component({
  selector: 'app-notifications-modal',
  templateUrl: './notifications-modal.component.html',
  styleUrls: ['./notifications-modal.component.scss'],
  standalone: false,
})
export class NotificationsModalComponent implements OnInit, OnDestroy {
  notifiche: Notifica[] = [];
  private notificheSubscription!: Subscription;
  private currentUserId: string | null = null; // ⭐⭐ NOVITÀ: Aggiungi una variabile per l'ID utente

  constructor(
    private modalController: ModalController,
    private notificheService: NotificheService,
    private router: Router
  ) { }

  ngOnInit() {
    this.currentUserId = getAuth().currentUser?.uid || null; // ⭐⭐ NOVITÀ: Salva l'ID utente
    this.notificheSubscription = this.notificheService.notifiche$.subscribe(notifiche => {
      this.notifiche = notifiche;
    });
  }

  ngOnDestroy() {
    if (this.notificheSubscription) {
      this.notificheSubscription.unsubscribe();
    }
  }

  dismiss() {
    this.notificheService.segnaTutteComeLette();
    this.modalController.dismiss();
  }

  async handleNotificationClick(notifica: Notifica) {
    if (notifica.id) {
      this.notificheService.segnaComeLetta(notifica.id);
    } else {
      console.warn("NotificationsModalComponent: L'ID della notifica non è definito. Impossibile segnare come letta.");
    }

    await this.modalController.dismiss();

    const tipoNotifica = notifica.tipo;
    const postId = notifica.postId;
    const projectId = notifica.projectId;

    // ⭐⭐ AGGIORNATO: Logica per la navigazione del nuovo follower
    if (tipoNotifica === 'nuovo_follower' && notifica.followerId) {
      // Se l'utente che ha seguito è l'utente corrente, naviga al profilo
      if (notifica.followerId === this.currentUserId) {
        this.router.navigate(['/profilo']);
      } else {
        // Altrimenti, naviga al profilo dell'altro utente
        this.router.navigate(['/profilo-altri-utenti', notifica.followerId]);
      }
    } else if (postId) {
      if ((tipoNotifica === 'commento' || tipoNotifica === 'menzione_commento' || tipoNotifica === 'mi_piace_commento') && notifica.commentId) {
        this.router.navigateByUrl(`/notizia-singola/${postId};commentId=${notifica.commentId}`);
      } else if (tipoNotifica === 'nuovo_post' || tipoNotifica === 'mi_piace' || tipoNotifica === 'menzione_post') {
        this.router.navigateByUrl(`/notizia-singola/${postId}`);
      } else {
      }
    } else if (projectId && tipoNotifica === 'invito_progetto') {
      this.router.navigateByUrl(`/progetti/${projectId}`);
    } else {
    }
  }
}
