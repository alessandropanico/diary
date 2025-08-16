import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ModalController, IonInfiniteScroll, AlertController } from '@ionic/angular';
import { NotificheService, Notifica } from 'src/app/services/notifiche.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { getAuth } from 'firebase/auth';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { ChangeDetectorRef } from '@angular/core';

export interface NotificaWithCreatorData extends Notifica {
  creatorUsername?: string;
  creatorAvatarUrl?: string;
}

@Component({
  selector: 'app-notifications-modal',
  templateUrl: './notifications-modal.component.html',
  styleUrls: ['./notifications-modal.component.scss'],
  standalone: false,
})
export class NotificationsModalComponent implements OnInit, OnDestroy {
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  notifiche: NotificaWithCreatorData[] = [];
  private notificheSubscription!: Subscription;
  private currentUserId: string | null = null;

  private notificheLimit: number = 10;
  private lastTimestamp: any | null = null;
  canLoadMore: boolean = true;
  isLoading: boolean = true;

  constructor(
    private modalController: ModalController,
    private notificheService: NotificheService,
    private router: Router,
    private alertCtrl: AlertController,
    private userDataService: UserDataService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.currentUserId = getAuth().currentUser?.uid || null;
    this.loadInitialNotifications();
  }

  ngOnDestroy() {
    if (this.notificheSubscription) {
      this.notificheSubscription.unsubscribe();
    }
  }

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

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
    }

    this.notificheSubscription = this.notificheService.getNotifichePaginated(this.currentUserId, this.notificheLimit).subscribe({
      next: async (notifiche) => {
        this.notifiche = await this.populateCreatorData(notifiche);
        this.isLoading = false;
        if (this.notifiche.length > 0) {
          this.lastTimestamp = this.notifiche[this.notifiche.length - 1].timestamp;
        }
        if (notifiche.length < this.notificheLimit) {
          this.canLoadMore = false;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Errore nel caricamento iniziale delle notifiche:', err);
        this.isLoading = false;
        this.canLoadMore = false;
        this.presentAppAlert('Errore', 'Impossibile caricare le notifiche.');
        this.cdr.detectChanges();
      }
    });
  }

  async loadMoreNotifications(event: any) {
    if (!this.canLoadMore || !this.currentUserId) {
      if (this.infiniteScroll) {
        this.infiniteScroll.complete();
        this.infiniteScroll.disabled = true;
      }
      return;
    }

    const subscription = this.notificheService.getNotifichePaginated(this.currentUserId, this.notificheLimit, this.lastTimestamp).subscribe({
      next: async (notifiche) => {
        const newNotifiche = await this.populateCreatorData(notifiche);
        this.notifiche = [...this.notifiche, ...newNotifiche];

        if (notifiche.length > 0) {
          this.lastTimestamp = notifiche[notifiche.length - 1].timestamp;
        }
        if (notifiche.length < this.notificheLimit) {
          this.canLoadMore = false;
          this.infiniteScroll.disabled = true;
        }
        this.infiniteScroll.complete();
        this.cdr.detectChanges();
        subscription.unsubscribe();
      },
      error: (err) => {
        console.error('Errore nel caricamento di altre notifiche:', err);
        this.canLoadMore = false;
        this.infiniteScroll.disabled = true;
        this.infiniteScroll.complete();
        this.presentAppAlert('Errore', 'Impossibile caricare altre notifiche.');
        this.cdr.detectChanges();
        subscription.unsubscribe();
      }
    });
  }

  /**
   * ⭐ AGGIORNATO: Questo metodo ora usa solo il campo 'photo' per l'URL dell'avatar.
   */
  private async populateCreatorData(notifiche: Notifica[]): Promise<NotificaWithCreatorData[]> {
    if (notifiche.length === 0) {
      return [];
    }

    const creatorIds = [...new Set(notifiche.map(n => n.creatorId).filter(id => id != null) as string[])];
    const userPromises = creatorIds.map(id => this.userDataService.getUserDataByUid(id));
    const userResults = await Promise.all(userPromises);
   console.log('Dati utente recuperati:', userResults); // ⭐ Aggiungi questo log

    const userMap = new Map<string, UserDashboardCounts | null>();
    creatorIds.forEach((id, index) => userMap.set(id, userResults[index]));

    return notifiche.map(notifica => {
      let creatorUsername = '';
      let creatorAvatarUrl = 'assets/immaginiGenerali/default-avatar.jpg';

      if (notifica.creatorId) {
        const creatorData = userMap.get(notifica.creatorId);
        if (creatorData) {
          creatorUsername = creatorData.nickname || '';
          // ⭐ Corretto: Controlla che il campo 'photo' non sia vuoto
          if (creatorData.photo) {
            creatorAvatarUrl = creatorData.photo;
          }
        }
      }

      return { ...notifica, creatorUsername, creatorAvatarUrl } as NotificaWithCreatorData;
    });
  }

  dismiss() {
    this.notificheService.segnaTutteComeLette();
    this.modalController.dismiss();
  }

  async handleNotificationClick(notifica: NotificaWithCreatorData) {
    if (notifica.id) {
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

  formatNotificationTime(timestamp: any): string {
    if (!timestamp) {
      return 'Data non disponibile';
    }

    let date: Date;
    // Controlla se l'oggetto timestamp è di tipo Firebase Timestamp
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else {
      // Altrimenti, assumi che sia una data o un numero
      date = new Date(timestamp);
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Adesso';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minuto' : 'minuti'} fa`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;
    } else if (diffInSeconds < 2592000) { // Circa 30 giorni
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;
    } else {
      // Se la differenza è maggiore, mostra la data completa
      return date.toLocaleDateString('it-IT', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
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
