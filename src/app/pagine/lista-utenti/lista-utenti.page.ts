import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  AfterViewInit,
  NgZone,
} from '@angular/core';
import { IonContent, LoadingController } from '@ionic/angular';
import { UsersService } from 'src/app/services/users.service';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { AppUser } from 'src/app/interfaces/app-user';
import { Router } from '@angular/router';

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

  // Rimuovi 'private' se vuoi renderlo accessibile in isFollowing direttamente per debug,
  // ma è già usato dal metodo.
  followingUserIds = new Set<string>(); // ID degli utenti seguiti - Non private per accesso diretto da isFollowing

  currentUserId: string | null = null;
  initialLoading = true;

  constructor(
    private usersService: UsersService,
    private loadingCtrl: LoadingController,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit() {
    const auth = getAuth();
    this.currentUserId = auth.currentUser?.uid || null;

    // *** Sottoscrizione allo stato dei "following" dal servizio ***
    // Questo Observable si aggiornerà ogni volta che il servizio emette un nuovo stato.
    this.followingStatusSub = this.usersService
      .getFollowingStatus()
      .subscribe(status => {
        // ngZone.run() è cruciale qui per assicurarsi che l'UI si aggiorni
        // in risposta ai cambiamenti asincroni dello stato dei following.
        this.ngZone.run(() => {
          this.followingUserIds = status;
          console.log('ListaUtentiPage: Stato following aggiornato:', this.followingUserIds);
        });
      });
  }

  ngAfterViewInit() {
    // Delay per evitare ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => this.loadUsers(), 0);
  }

  ngOnDestroy() {
    this.userSub?.unsubscribe();
    this.followingStatusSub?.unsubscribe(); // Assicurati di fare l'unsubscribe
  }

  async loadUsers(event?: any) {
    if (this.isLoading) {
      event?.target.complete();
      return;
    }

    this.isLoading = true;

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
            this.initialLoading = false;

            if (event) {
              event.target.complete();
              event.target.disabled = users.length < this.usersService['pageSize'];
            }
          });
        },
        error: (err) => {
          console.error('Errore durante il caricamento utenti:', err);
          this.isLoading = false;
          this.initialLoading = false;
          event?.target.complete();
        }
      });
  }

  async doRefresh(event: any) {
    this.users = [];
    this.lastVisible = null;
    this.isLoading = false;
    this.initialLoading = true;

    // *** Chiamata per ricaricare lo stato dei following al refresh ***
    await this.usersService.refreshFollowingStatus();

    // Reabilita l'infinite scroll
    if (event && event.target && event.target.getNativeElement) {
        const infiniteScrollEl = event.target.getNativeElement().querySelector('ion-infinite-scroll');
        if (infiniteScrollEl) {
            infiniteScrollEl.disabled = false;
        }
    }

    event?.target?.complete();
    this.loadUsers();
  }

  // Questo metodo è corretto, si basa sul Set aggiornato
  isFollowing(userId: string): boolean {
    return this.followingUserIds.has(userId);
  }

  async toggleFollow(userId: string) {
    // Il LoadingController qui è opzionale, se vuoi un feedback visivo sull'azione specifica
    const loading = await this.loadingCtrl.create({
        message: this.isFollowing(userId) ? 'Annullamento follow...' : 'Seguendo...',
        duration: 2000, // Durata massima, verrà dismissato prima in caso di successo/errore
    });
    await loading.present();

    try {
        await this.usersService.toggleFollow(userId);
        // Lo stato `this.followingUserIds` si aggiornerà automaticamente
        // grazie alla sottoscrizione a `getFollowingStatus()` nel ngOnInit.
    } catch (error) {
        console.error('Errore nell\'operazione di follow/unfollow:', error);
        // Potresti voler mostrare un Alert qui
    } finally {
        await loading.dismiss(); // Assicurati di dismissare il loading
    }
  }

   goToUserProfile(userId: string) {
    console.log('ListaUtentiPage: Navigazione a profilo utente:', userId);
    if (userId === this.currentUserId) {
      // Se l'utente clicca sul proprio profilo nella lista (anche se filtrato, per sicurezza)
      this.router.navigate(['/profilo']);
    } else {
      // Naviga al profilo di un altro utente
      this.router.navigate(['/profilo-altri-utenti', userId]);
    }
  }
}
