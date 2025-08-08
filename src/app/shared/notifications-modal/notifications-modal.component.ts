import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { NotificheService, Notifica  } from 'src/app/services/notifiche.service';
import { Subscription } from 'rxjs';

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
    private notificheService: NotificheService
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

  // Metodo per segnare una singola notifica come letta
  segnaNotificaComeLetta(notifica: Notifica) {
    if (!notifica.letta) {
      this.notificheService.segnaComeLetta(notifica.id);
    }
    // Puoi anche aggiungere qui la logica per navigare al link della notifica
    if (notifica.link) {
      // Esempio: this.router.navigateByUrl(notifica.link);
    }
  }
}
