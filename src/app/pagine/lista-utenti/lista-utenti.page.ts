import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  AfterViewInit,
  NgZone,
} from '@angular/core';
import { IonContent, LoadingController } from '@ionic/angular';
import { UsersService, AppUser } from 'src/app/services/users.service';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';

@Component({
  selector: 'app-lista-utenti',
  templateUrl: './lista-utenti.page.html',
  styleUrls: ['./lista-utenti.page.scss'],
  standalone: false,
})
export class ListaUtentiPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(IonContent) content!: IonContent;

  users: AppUser[] = [];
  private lastVisible: any = null;
  private isLoading = false;
  private userSub?: Subscription;
  private followingStatusSub?: Subscription;
  private followingUserIds = new Set<string>();
  currentUserId: string | null = null;

  initialLoading = true; // Indica se è il caricamento iniziale della pagina

  constructor(
    private usersService: UsersService,
    private loadingCtrl: LoadingController, // Manteniamo il LoadingController nel costruttore nel caso lo usassi altrove
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    const auth = getAuth();
    this.currentUserId = auth.currentUser?.uid || null;

    this.followingStatusSub = this.usersService
      .getFollowingStatus()
      .subscribe(status => {
        this.followingUserIds = status;
      });
  }

  ngAfterViewInit() {
    // Delay for avoiding ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => this.loadUsers(), 0);
  }

  ngOnDestroy() {
    this.userSub?.unsubscribe();
    this.followingStatusSub?.unsubscribe();
  }

  async loadUsers(event?: any) {
    if (this.isLoading) {
      event?.target.complete();
      return;
    }

    this.isLoading = true;

    // *** RIMOSSO IL LoadingController DA QUI ***
    // let loading: HTMLIonLoadingElement | undefined;
    // if (!event) {
    //   loading = await this.loadingCtrl.create({
    //     message: 'Caricamento utenti...',
    //   });
    //   await loading.present();
    // }
    // *****************************************

    this.userSub = this.usersService
      .getPaginatedUsers(this.lastVisible)
      .pipe(take(1))
      .subscribe({
        next: ({ users, lastVisible }) => {
          this.ngZone.run(() => {
            const filteredUsers = users.filter(u => u.uid !== this.currentUserId);
            this.users = [...this.users, ...filteredUsers];
            this.lastVisible = lastVisible;
            this.isLoading = false;

            // Imposta initialLoading a false DOPO che i dati sono stati caricati (o meno)
            this.initialLoading = false;

            if (event) {
              event.target.complete();
              // Disabilita lo scroll infinito se non ci sono più elementi da caricare
              event.target.disabled = users.length < this.usersService['pageSize'];
            }

            // loading?.dismiss(); // Rimuovi anche questa riga
          });
        },
        error: (err) => {
          console.error('Errore durante il caricamento utenti:', err);
          this.isLoading = false;
          // Imposta initialLoading a false anche in caso di errore
          this.initialLoading = false;
          event?.target.complete();
          // loading?.dismiss(); // Rimuovi anche questa riga
        }
      });
  }

  async doRefresh(event: any) {
    this.users = [];
    this.lastVisible = null;
    this.isLoading = false;
    this.initialLoading = true; // Resetta a true per mostrare lo skeleton al refresh

    await this.usersService.refreshFollowingStatus();

    // Reabilita l'infinite scroll, se era stato disabilitato
    if (event && event.target && event.target.getNativeElement) {
        const infiniteScrollEl = event.target.getNativeElement().querySelector('ion-infinite-scroll');
        if (infiniteScrollEl) {
            infiniteScrollEl.disabled = false;
        }
    }

    event?.target?.complete(); // Completa il refresher
    this.loadUsers(); // Ricarica gli utenti
  }

  isFollowing(userId: string): boolean {
    return this.followingUserIds.has(userId);
  }

  async toggleFollow(userId: string) {
    // Se vuoi mostrare un loading specifico solo per l'azione di follow/unfollow,
    // potresti usare qui il LoadingController:
    // const loading = await this.loadingCtrl.create({ message: 'Aggiornamento...' });
    // await loading.present();
    await this.usersService.toggleFollow(userId);
    // await loading.dismiss();
  }
}
