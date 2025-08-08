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
   * Segna una notifica come letta e naviga alla pagina corrispondente.
   * @param notifica L'oggetto notifica da gestire.
   */
  async handleNotificationClick(notifica: Notifica) {
    // Segna la notifica come letta se non lo è già
    if (!notifica.letta) {
      this.notificheService.segnaComeLetta(notifica.id);
    }

    // Chiudi il modale
    await this.modalController.dismiss();

    // Naviga alla rotta della notizia singola se il link corrisponde
    if (notifica.link && notifica.link.startsWith('/notizia-singola')) {
      this.router.navigateByUrl(notifica.link);
    } else {
      // Puoi gestire qui altri tipi di link o navigare a una home di default
      // Ad esempio, se il tuo oggetto `notifica` ha un `postId`, puoi usare quello.
      // Se vuoi navigare solo per le notifiche di tipo 'post':
      if (notifica.tipo === 'nuovo_post') {
        this.router.navigateByUrl(`/notizia-singola/${notifica.postId}`);
      }
    }
  }
}
