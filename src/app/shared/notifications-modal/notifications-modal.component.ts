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
    this.modalController.dismiss();
    this.notificheService.segnaTutteComeLette();
  }

  async handleNotificationClick(notifica: Notifica) {
    // ⭐⭐ Modifica qui: aggiungi un controllo per assicurarti che l'ID esista ⭐⭐
    if (notifica.id) {
      this.notificheService.segnaComeLetta(notifica.id);
    } else {
      console.warn("L'ID della notifica non è definito. Impossibile segnare come letta.");
    }

    await this.modalController.dismiss();

    if (notifica.tipo === 'nuovo_post' && notifica.postId) {
      this.router.navigateByUrl(`/notizia-singola/${notifica.postId}`);
    } else {
      // Logica per altri tipi di notifiche
    }
  }
}
