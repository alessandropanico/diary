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

  // Metodo per chiudere la modale e segnare le notifiche come lette
  dismiss() {
    this.modalController.dismiss();
    this.notificheService.segnaTutteComeLette();
  }

   /**
   * Gestisce il click su una notifica, segnandola come letta e navigando.
   * @param notifica L'oggetto notifica su cui si è cliccato.
   */
  async handleNotificationClick(notifica: Notifica) {
    if (!notifica.letta) {
      this.notificheService.segnaComeLetta(notifica.id);
    }

    // Chiudi il modale
    await this.modalController.dismiss();

    // Naviga in base al tipo di notifica
    if (notifica.tipo === 'nuovo_post' && notifica.postId) {
      this.router.navigateByUrl(`/notizia-singola/${notifica.postId}`);
    } else {
      // Puoi aggiungere logica per altri tipi di notifiche qui
      // Esempio: notifiche di mi piace o commenti
    }
  }
}
