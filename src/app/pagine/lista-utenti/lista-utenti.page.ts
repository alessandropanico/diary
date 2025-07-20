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
import { Subscription, Subject, of, from } from 'rxjs'; // Aggiungi Subject, of, from
import {
  take,
  debounceTime, // Necessario per la ricerca
  distinctUntilChanged, // Necessario per la ricerca
  switchMap, // Necessario per la ricerca
  catchError // Necessario per la ricerca
} from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { AppUser } from 'src/app/interfaces/app-user'; // Assicurati che AppUser abbia le proprietà per la ricerca (nickname, firstName, lastName, photo)
import { Router } from '@angular/router';
import { UserDataService } from 'src/app/services/user-data.service'; // ⭐ Importa UserDataService

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
  private isLoading = false; // Indica se il caricamento della lista principale è in corso
  private userSub?: Subscription;
  private followingStatusSub?: Subscription;

  followingUserIds = new Set<string>();

  currentUserId: string | null = null;
  initialLoading = true; // Indica il caricamento iniziale della pagina

  // ⭐ Proprietà per la searchbar e la ricerca
  showSearchbar: boolean = false;
  searchQuery: string = '';
  searchResults: AppUser[] = []; // I risultati della ricerca saranno di tipo AppUser
  isSearchingUsers: boolean = false; // Indica se la ricerca utenti è in corso (mostra spinner)
  searchPerformed: boolean = false; // Indica se una ricerca è stata eseguita almeno una volta
  private searchTerms = new Subject<string>(); // Subject per gestire i termini di ricerca
  private searchSubscription: Subscription | undefined; // Sottoscrizione per la ricerca

  constructor(
    private usersService: UsersService,
    private loadingCtrl: LoadingController,
    private ngZone: NgZone,
    private router: Router,
    private userDataService: UserDataService // ⭐ Inietta UserDataService
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

    // ⭐ Imposta la logica di ricerca all'inizializzazione del componente
    this.setupSearch();
  }

  ngAfterViewInit() {
    // Carica gli utenti iniziali solo se la searchbar non è attiva o la query è vuota
    if (!this.showSearchbar || this.searchQuery.length === 0) {
      setTimeout(() => this.loadUsers(), 0);
    }
  }

  ngOnDestroy() {
    this.userSub?.unsubscribe();
    this.followingStatusSub?.unsubscribe();
    this.searchSubscription?.unsubscribe(); // ⭐ Disiscriviti dalla sottoscrizione di ricerca
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
              // Disabilita l'infinite scroll se non ci sono più utenti
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
    // Resetta solo la lista principale degli utenti se la searchbar non è attiva
    if (!this.showSearchbar || this.searchQuery.length === 0) {
      this.users = [];
      this.lastVisible = null;
      this.isLoading = false;
      this.initialLoading = true; // Imposta a true per mostrare lo spinner iniziale durante il refresh

      await this.usersService.refreshFollowingStatus();

      // Reabilita l'infinite scroll
      if (event && event.target && event.target.getNativeElement) {
        const infiniteScrollEl = event.target.getNativeElement().querySelector('ion-infinite-scroll');
        if (infiniteScrollEl) {
          infiniteScrollEl.disabled = false;
        }
      }
      this.loadUsers(); // Ricarica gli utenti
    } else {
      // Se la searchbar è attiva, non fare nulla o ricarica i risultati di ricerca se vuoi
      // Per ora, non facciamo nulla sul refresh se siamo in modalità ricerca
      console.log('Refresh non applicabile in modalità ricerca.');
    }
    event?.target?.complete(); // Completa sempre l'evento di refresh
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
      // Lo stato `this.followingUserIds` si aggiornerà automaticamente
      // grazie alla sottoscrizione a `getFollowingStatus()` nel ngOnInit.
    } catch (error) {
      console.error('Errore nell\'operazione di follow/unfollow:', error);
      // Potresti voler mostrare un Alert qui
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
      // Quando la searchbar viene nascosta, ricarica la lista utenti principale
      // solo se non è già stata caricata o se vuoi forzare il ricaricamento
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
    // Se la query è vuota, resetta i risultati e lo stato di ricerca
    if (this.searchQuery.trim().length === 0) {
      this.searchResults = [];
      this.isSearchingUsers = false;
      this.searchPerformed = false;
      return;
    }
    this.isSearchingUsers = true; // Mostra lo spinner
    this.searchPerformed = true; // Indica che è stata eseguita una ricerca
    this.searchTerms.next(this.searchQuery); // Emette il termine di ricerca
  }

  /**
   * Configura la pipeline RxJS per la ricerca utenti.
   */
  private setupSearch() {
    this.searchSubscription = this.searchTerms.pipe(
      debounceTime(300), // Aspetta 300ms dopo l'ultimo input dell'utente
      distinctUntilChanged(), // Emetti solo se il termine di ricerca è cambiato
      switchMap((term: string) => {
        if (term.trim() === '') {
          this.searchResults = [];
          this.isSearchingUsers = false;
          this.searchPerformed = false;
          return of([]); // Restituisce un observable vuoto se il termine è vuoto
        }
        // Chiama il servizio per la ricerca
        return from(this.userDataService.searchUsers(term)).pipe(
          catchError((error) => {
            console.error('Errore durante la ricerca utenti:', error);
            this.isSearchingUsers = false;
            return of([]); // In caso di errore, restituisce un array vuoto
          })
        );
      })
    ).subscribe((results: AppUser[]) => {
      this.ngZone.run(() => { // Assicurati che gli aggiornamenti dell'UI siano eseguiti all'interno di NgZone
        // Filtra l'utente corrente dai risultati della ricerca
        this.searchResults = results.filter(user => user.uid !== this.currentUserId);
        this.isSearchingUsers = false; // Nascondi lo spinner
      });
    });
  }
}
