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

  constructor(
    private usersService: UsersService,
    private loadingCtrl: LoadingController,
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
    let loading: HTMLIonLoadingElement | undefined;

    if (!event) {
      loading = await this.loadingCtrl.create({
        message: 'Caricamento utenti...',
      });
      await loading.present();
    }

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

            if (event) {
              event.target.complete();
              event.target.disabled = users.length < this.usersService['pageSize'];
            }

            loading?.dismiss();
          });
        },
        error: (err) => {
          console.error('Errore durante il caricamento utenti:', err);
          this.isLoading = false;
          event?.target.complete();
          loading?.dismiss();
        }
      });
  }

  async doRefresh(event: any) {
    this.users = [];
    this.lastVisible = null;
    this.isLoading = false;

    await this.usersService.refreshFollowingStatus();

    event?.target?.complete();
    this.loadUsers();
  }

  isFollowing(userId: string): boolean {
    return this.followingUserIds.has(userId);
  }

  async toggleFollow(userId: string) {
    await this.usersService.toggleFollow(userId);
  }
}
