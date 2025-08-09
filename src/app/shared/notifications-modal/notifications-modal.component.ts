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
    console.log('NotificationsModalComponent: Inizializzazione componente. Sottoscrizione al flusso di notifiche.');
    this.notificheSubscription = this.notificheService.notifiche$.subscribe(notifiche => {
      this.notifiche = notifiche;
      console.log('NotificationsModalComponent: Notifiche aggiornate.', notifiche);
    });
  }

  ngOnDestroy() {
    console.log('NotificationsModalComponent: Distruzione componente. Annullamento della sottoscrizione.');
    if (this.notificheSubscription) {
      this.notificheSubscription.unsubscribe();
    }
  }

  dismiss() {
    console.log('NotificationsModalComponent: Chiusura del modale. Segno tutte le notifiche come lette.');
    this.modalController.dismiss();
    this.notificheService.segnaTutteComeLette();
  }

  async handleNotificationClick(notifica: Notifica) {
    console.log('NotificationsModalComponent: Click su notifica.', notifica);
    if (notifica.id) {
      console.log(`NotificationsModalComponent: Segno la notifica con ID ${notifica.id} come letta.`);
      this.notificheService.segnaComeLetta(notifica.id);
    } else {
      console.warn("NotificationsModalComponent: L'ID della notifica non è definito. Impossibile segnare come letta.");
    }

    await this.modalController.dismiss();
    console.log('NotificationsModalComponent: Modale chiuso.');

    const tipoNotifica = notifica.tipo;
    const postId = notifica.postId;

    console.log(`NotificationsModalComponent: Tipo di notifica: ${tipoNotifica}, Post ID: ${postId}, Comment ID: ${notifica.commentId}`);

    if (postId) {
      if ((tipoNotifica === 'commento' || tipoNotifica === 'menzione_commento' || tipoNotifica === 'mi_piace_commento') && notifica.commentId) {
        console.log(`Navigazione con commento evidenziato: /notizia-singola/${postId};commentId=${notifica.commentId}`);
        this.router.navigateByUrl(`/notizia-singola/${postId};commentId=${notifica.commentId}`);
      } else if (tipoNotifica === 'nuovo_post' || tipoNotifica === 'mi_piace') {
        console.log(`Navigazione a: /notizia-singola/${postId}`);
        this.router.navigateByUrl(`/notizia-singola/${postId}`);
      } else {
        console.log('NotificationsModalComponent: Nessuna azione di navigazione definita per questo tipo di notifica.');
      }
    } else {
      console.log('NotificationsModalComponent: L\'ID del post non è definito. Nessuna navigazione.');
    }
  }
}
