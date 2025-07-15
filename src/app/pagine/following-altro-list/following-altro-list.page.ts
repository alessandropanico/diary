import { Component, OnInit, OnDestroy, NgZone } from '@angular/core'; // Aggiungi NgZone
import { ActivatedRoute, Router } from '@angular/router'; // Aggiungi Router
import { FollowService } from 'src/app/services/follow.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Importa per ottenere l'utente loggato

@Component({
  selector: 'app-following-altro-list',
  templateUrl: './following-altro-list.page.html',
  styleUrls: ['./following-altro-list.page.scss'],
  standalone: false,
})
export class FollowingAltroListPage implements OnInit, OnDestroy {
  targetUserId: string | null = null;
  following: any[] = []; // Manteniamo any[] come richiesto
  isLoading: boolean = true;
  loggedInUserId: string | null = null; // Nuovo: ID dell'utente attualmente loggato

  private allSubscriptions: Subscription = new Subscription();
  private authStateUnsubscribe: (() => void) | undefined; // Per gestire l'unsubscribe di onAuthStateChanged

  constructor(
    private route: ActivatedRoute,
    private router: Router, // Iniettato Router per la navigazione programmatica
    private followService: FollowService,
    private userDataService: UserDataService,
    private ngZone: NgZone // Iniettato NgZone per gestire aggiornamenti UI da contesti non-Angular
  ) { }

  ngOnInit() {
    this.isLoading = true;

    // 1. Ottieni l'ID dell'utente loggato in modo reattivo
    const auth = getAuth();
    this.authStateUnsubscribe = onAuthStateChanged(auth, (user) => {
      // Usa ngZone.run per assicurarti che gli aggiornamenti dello stato
      // (come this.loggedInUserId) siano rilevati da Angular e aggiornino l'UI.
      this.ngZone.run(() => {
        this.loggedInUserId = user ? user.uid : null;
        console.log('FollowingAltroListPage: Utente loggato ID:', this.loggedInUserId);
        // Una volta ottenuto l'ID utente loggato, carica la lista dei seguiti
        this.loadFollowingList();
      });
    });
  }

  private loadFollowingList() {
    const routeSub = this.route.paramMap.subscribe(async params => {
      this.targetUserId = params.get('id');
      console.log('FollowingAltroListPage: ID utente del profilo da URL:', this.targetUserId);

      if (this.targetUserId) {
        this.isLoading = true; // Resetta isLoading ad ogni cambio di utente target

        // Aggiungi la sottoscrizione alla lista di gestione per l'unsubscribe in OnDestroy
        this.allSubscriptions.add(
          this.followService.getFollowingIds(this.targetUserId).subscribe(async followingIds => {
            console.log('FollowingAltroListPage: ID persone seguite raw:', followingIds);
            const loadedFollowing: any[] = []; // Manteniamo any[] come richiesto
            for (const followingId of followingIds) {
              try {
                // Recupera i dati di ogni utente seguito
                const userData = await this.userDataService.getUserDataById(followingId);
                if (userData) {
                  // Aggiungi l'uid all'oggetto utente, dato che getUserDataById potrebbe non includerlo
                  loadedFollowing.push({ uid: followingId, ...userData });
                }
              } catch (error) {
                console.error('Errore nel caricare i dati della persona seguita:', followingId, error);
              }
            }
            // Aggiorna la lista 'following' e lo stato di caricamento all'interno della zona di Angular
            this.ngZone.run(() => {
              this.following = loadedFollowing;
              this.isLoading = false;
              console.log('FollowingAltroListPage: Persone seguite caricate:', this.following);
            });
          }, error => {
            console.error('Errore nel recupero degli ID persone seguite:', error);
            this.ngZone.run(() => { // Assicurati di aggiornare isLoading anche in caso di errore
              this.isLoading = false;
            });
          })
        );
      } else {
        console.warn('FollowingAltroListPage: ID utente mancante nella rotta.');
        this.isLoading = false;
      }
    });
    this.allSubscriptions.add(routeSub); // Aggiungi la sottoscrizione della route
  }


  ngOnDestroy(): void {
    // Assicurati di disiscriverti da onAuthStateChanged per evitare memory leaks
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    // Disiscrivi tutte le sottoscrizioni RxJS gestite da allSubscriptions
    this.allSubscriptions.unsubscribe();
  }

  /**
   * Naviga al profilo dell'utente cliccato.
   * Se l'ID cliccato corrisponde all'ID dell'utente attualmente loggato,
   * reindirizza alla pagina del proprio profilo (`/profilo`).
   * Altrimenti, reindirizza alla pagina del profilo di altri utenti (`/profilo-altri-utenti/:id`).
   * @param userId L'ID dell'utente di cui visualizzare il profilo.
   */
  goToUserProfile(userId: string) {
    console.log('goToUserProfile chiamato per ID:', userId, 'Utente loggato ID:', this.loggedInUserId);
    if (userId && this.loggedInUserId && userId === this.loggedInUserId) {
      // Se l'utente clicca sul proprio ID, va al proprio profilo
      this.router.navigate(['/profilo']);
    } else if (userId) {
      // Altrimenti, va al profilo dell'utente specifico
      this.router.navigate(['/profilo-altri-utenti', userId]);
    } else {
      console.warn('goToUserProfile: ID utente non valido o mancante.');
    }
  }
}
