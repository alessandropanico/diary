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
import { Subscription, Subject, of, from } from 'rxjs';
import {
  take,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError
} from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { AppUser } from 'src/app/interfaces/app-user';
import { Router } from '@angular/router';
import { UserDataService } from 'src/app/services/user-data.service';

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
  followingUserIds = new Set<string>();
  currentUserId: string | null = null;
  initialLoading = true;
  showSearchbar: boolean = false;
  searchQuery: string = '';
  searchResults: AppUser[] = [];
  isSearchingUsers: boolean = false;
  searchPerformed: boolean = false;
  private searchTerms = new Subject<string>();
  private searchSubscription: Subscription | undefined;

  constructor(
    private usersService: UsersService,
    private loadingCtrl: LoadingController,
    private ngZone: NgZone,
    private router: Router,
    private userDataService: UserDataService
  ) {}

  ngOnInit() {
    const auth = getAuth();
    this.currentUserId = auth.currentUser?.uid || null;

    this.followingStatusSub = this.usersService
      .getFollowingStatus()
      .subscribe(status => {
        this.ngZone.run(() => {
          this.followingUserIds = status;
        });
      });

    this.setupSearch();
  }

  ngAfterViewInit() {
    if (!this.showSearchbar || this.searchQuery.length === 0) {
      setTimeout(() => this.loadUsers(), 0);
    }
  }

  ngOnDestroy() {
    this.userSub?.unsubscribe();
    this.followingStatusSub?.unsubscribe();
    this.searchSubscription?.unsubscribe();
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
            // const filteredUsers = users.filter(u => u.uid !== this.currentUserId);
            // this.users = [...this.users, ...filteredUsers];

            // const filteredUsers = users.filter(u => u.uid !== this.currentUserId);
            this.users = [...this.users, ...users];


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
    if (!this.showSearchbar || this.searchQuery.length === 0) {
      this.users = [];
      this.lastVisible = null;
      this.isLoading = false;
      this.initialLoading = true;

      await this.usersService.refreshFollowingStatus();

      if (event && event.target && event.target.getNativeElement) {
        const infiniteScrollEl = event.target.getNativeElement().querySelector('ion-infinite-scroll');
        if (infiniteScrollEl) {
          infiniteScrollEl.disabled = false;
        }
      }
      this.loadUsers();
    } else {
      console.log('Refresh non applicabile in modalità ricerca.');
    }
    event?.target?.complete();
  }

  isFollowing(userId: string): boolean {
    return this.followingUserIds.has(userId);
  }

  async toggleFollow(userId: string) {
    const loading = await this.loadingCtrl.create({
      message: this.isFollowing(userId) ? 'Annullamento follow...' : 'Seguendo...',
      duration: 2000,
    });
    await loading.present();

    try {
      await this.usersService.toggleFollow(userId);
    } catch (error) {
      console.error('Errore nell\'operazione di follow/unfollow:', error);
    } finally {
      await loading.dismiss();
    }
  }

  goToUserProfile(userId: string) {
    if (userId === this.currentUserId) {
      this.router.navigate(['/profilo']);
    } else {
      this.router.navigate(['/profilo-altri-utenti', userId]);
    }
  }

  getUserPhoto(photoUrl: string | null | undefined): string {
    const defaultGoogleProfilePicture = 'https://lh3.googleusercontent.com/a/ACg8ocK-pW1q9zsWi1DHCcamHuNOTLOvotU44G2v2qtMUtWu3LI0FOE=s96-c';
    if (!photoUrl || photoUrl === '' || photoUrl === defaultGoogleProfilePicture) {
      return 'assets/immaginiGenerali/default-avatar.jpg';
    }
    return photoUrl;
  }

  /**
   * Attiva/disattiva la barra di ricerca.
   * Resetta lo stato della ricerca quando viene disattivata.
   */
  toggleSearchbar() {
    this.showSearchbar = !this.showSearchbar;
    if (!this.showSearchbar) {
      this.searchQuery = ''; // Resetta la query
      this.searchResults = []; // Cancella i risultati
      this.searchPerformed = false; // Resetta lo stato
      this.isSearchingUsers = false; // Resetta lo spinner
      if (this.users.length === 0 && !this.initialLoading) {
        this.loadUsers();
      }
    }
  }

  /**
   * Gestisce l'input nella searchbar.
   * Utilizza debounceTime e distinctUntilChanged per ottimizzare le chiamate di ricerca.
   * @param event L'evento di input.
   */
  onSearchInput(event: any) {
    this.searchQuery = event.target.value;
    if (this.searchQuery.trim().length === 0) {
      this.searchResults = [];
      this.isSearchingUsers = false;
      this.searchPerformed = false;
      return;
    }
    this.isSearchingUsers = true;
    this.searchPerformed = true;
    this.searchTerms.next(this.searchQuery);
  }

  /**
   * Configura la pipeline RxJS per la ricerca utenti.
   */
  private setupSearch() {
    this.searchSubscription = this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) => {
        if (term.trim() === '') {
          this.searchResults = [];
          this.isSearchingUsers = false;
          this.searchPerformed = false;
          return of([]);
        }
        return from(this.userDataService.searchUsers(term)).pipe(
          catchError((error) => {
            console.error('Errore durante la ricerca utenti:', error);
            this.isSearchingUsers = false;
            return of([]);
          })
        );
      })
    ).subscribe((results: AppUser[]) => {
      this.ngZone.run(() => {
        // this.searchResults = results.filter(user => user.uid !== this.currentUserId);
        this.searchResults = results;
        console.log('Risultati ricerca:', results);
        this.isSearchingUsers = false;
      });
    });
  }
}
