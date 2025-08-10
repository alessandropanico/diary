// src/app/components/notifications-modal/notifications-modal.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { NotificheService, Notifica } from 'src/app/services/notifiche.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-notifications-modal',
  templateUrl: './notifications-modal.component.html',
  styleUrls: ['./notifications-modal.component.scss'],
  standalone: false,
})
export class NotificationsModalComponent implements OnInit, OnDestroy {
  notifiche: Notifica[] = [];
  private notificheSubscription!: Subscription;

  constructor(
    private modalController: ModalController,
    private notificheService: NotificheService,
    private router: Router
  ) {}

  ngOnInit() {
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


    if (postId) {
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
