import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ModalController, IonInfiniteScroll, AlertController } from '@ionic/angular';
import { NotificheService, Notifica } from 'src/app/services/notifiche.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { getAuth } from 'firebase/auth';

@Component({
  selector: 'app-notifications-modal',
  templateUrl: './notifications-modal.component.html',
  styleUrls: ['./notifications-modal.component.scss'],
  standalone: false,
})
export class NotificationsModalComponent implements OnInit, OnDestroy {
  // ⭐ NOVITÀ: Ottieni un riferimento al componente ion-infinite-scroll nel DOM
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  notifiche: Notifica[] = [];
  private notificheSubscription!: Subscription;
  private currentUserId: string | null = null;

  // ⭐ NOVITÀ: Variabili per la paginazione e lo stato di caricamento
  private notificheLimit: number = 10;
  private lastTimestamp: any | null = null;
  canLoadMore: boolean = true;
  isLoading: boolean = true;

  constructor(
    private modalController: ModalController,
    private notificheService: NotificheService,
    private router: Router,
    private alertCtrl: AlertController // ⭐ NOVITÀ: Iniettiamo AlertController
  ) { }

  ngOnInit() {
    this.currentUserId = getAuth().currentUser?.uid || null;
    // ⭐ NOVITÀ: Chiamiamo il metodo per caricare il primo blocco di notifiche
    this.loadInitialNotifications();
  }

  ngOnDestroy() {
    if (this.notificheSubscription) {
      this.notificheSubscription.unsubscribe();
    }
  }

  // ⭐ NOVITÀ: Metodo per caricare il primo blocco di 10 notifiche
  async loadInitialNotifications() {
    if (!this.currentUserId) {
      console.error('ID utente corrente non disponibile.');
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.notifiche = [];
    this.lastTimestamp = null;
    this.canLoadMore = true;

    // Resetta lo stato di ion-infinite-scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
    }

    this.notificheSubscription = this.notificheService.getNotifichePaginated(this.currentUserId, this.notificheLimit).subscribe({
      next: (notifiche) => {
        this.notifiche = notifiche;
        this.isLoading = false;
        if (notifiche.length > 0) {
          this.lastTimestamp = notifiche[notifiche.length - 1].timestamp;
        }
        if (notifiche.length < this.notificheLimit) {
          this.canLoadMore = false;
        }
      },
      error: (err) => {
        console.error('Errore nel caricamento iniziale delle notifiche:', err);
        this.isLoading = false;
        this.canLoadMore = false;
        this.presentAppAlert('Errore', 'Impossibile caricare le notifiche.');
      }
    });
  }

  // ⭐ NOVITÀ: Metodo per caricare il blocco successivo di notifiche
  async loadMoreNotifications(event: any) {
    if (!this.canLoadMore || !this.currentUserId) {
      if (this.infiniteScroll) {
        this.infiniteScroll.complete();
        this.infiniteScroll.disabled = true;
      }
      return;
    }

    const subscription = this.notificheService.getNotifichePaginated(this.currentUserId, this.notificheLimit, this.lastTimestamp).subscribe({
      next: (notifiche) => {
        this.notifiche = [...this.notifiche, ...notifiche];
        if (notifiche.length > 0) {
          this.lastTimestamp = notifiche[notifiche.length - 1].timestamp;
        }
        if (notifiche.length < this.notificheLimit) {
          this.canLoadMore = false;
          this.infiniteScroll.disabled = true;
        }
        this.infiniteScroll.complete();
        subscription.unsubscribe();
      },
      error: (err) => {
        console.error('Errore nel caricamento di altre notifiche:', err);
        this.canLoadMore = false;
        this.infiniteScroll.disabled = true;
        this.infiniteScroll.complete();
        subscription.unsubscribe();
        this.presentAppAlert('Errore', 'Impossibile caricare altre notifiche.');
      }
    });
  }

  dismiss() {
    this.notificheService.segnaTutteComeLette();
    this.modalController.dismiss();
  }

  async handleNotificationClick(notifica: Notifica) {
    if (notifica.id) {
      // ⭐ AGGIORNATO: Passiamo anche lo userId al metodo del servizio
      this.notificheService.segnaComeLetta(notifica.id, notifica.userId);
    } else {
      console.warn("NotificationsModalComponent: L'ID della notifica non è definito. Impossibile segnare come letta.");
    }

    await this.modalController.dismiss();

    const tipoNotifica = notifica.tipo;
    const postId = notifica.postId;
    const projectId = notifica.projectId;

    if (tipoNotifica === 'nuovo_follower' && notifica.followerId) {
      if (notifica.followerId === this.currentUserId) {
        this.router.navigate(['/profilo']);
      } else {
        this.router.navigate(['/profilo-altri-utenti', notifica.followerId]);
      }
    } else if (postId) {
      if ((tipoNotifica === 'commento' || tipoNotifica === 'menzione_commento' || tipoNotifica === 'mi_piace_commento') && notifica.commentId) {
        this.router.navigateByUrl(`/notizia-singola/${postId};commentId=${notifica.commentId}`);
      } else if (tipoNotifica === 'nuovo_post' || tipoNotifica === 'mi_piace' || tipoNotifica === 'menzione_post') {
        this.router.navigateByUrl(`/notizia-singola/${postId}`);
      }
    } else if (projectId && tipoNotifica === 'invito_progetto') {
      this.router.navigateByUrl(`/progetti/${projectId}`);
    }
  }

  private async presentAppAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      cssClass: 'app-alert',
      header: header,
      message: message,
      buttons: [
        {
          text: 'OK',
          cssClass: 'app-alert-button',
          role: 'cancel'
        }
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }
}
