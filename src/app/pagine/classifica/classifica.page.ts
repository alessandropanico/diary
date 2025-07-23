import { Component, OnInit, OnDestroy, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
import { IonInfiniteScroll } from '@ionic/angular';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { ExpService } from 'src/app/services/exp.service';
import { from, of } from 'rxjs';
import { Router } from '@angular/router';
import { getAuth, User, onAuthStateChanged } from 'firebase/auth';

@Component({
  selector: 'app-classifica',
  templateUrl: './classifica.page.html',
  styleUrls: ['./classifica.page.scss'],
  standalone: false,
})
export class ClassificaPage implements OnInit, OnDestroy {

  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  leaderboardUsers: UserDashboardCounts[] = [];
  isLoading: boolean = false;
  private usersSubscription!: Subscription;
  private lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | undefined = undefined;
  private pageSize: number = 10;
  public allUsersLoaded: boolean = false;
  private authSubscription!: Subscription;
  private loggedInUserId: string | null = null;

  // ⭐ AGGIORNAMENTO: Definisce il limite massimo della classifica
  private maxLeaderboardSize: number = 500;

  constructor(private userDataService: UserDataService,
    private expService: ExpService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.authSubscription = from(
      new Promise<User | null>(resolve => {
        const unsubscribe = onAuthStateChanged(getAuth(), user => {
          unsubscribe();
          resolve(user);
        });
      })
    ).subscribe(user => {
      this.loggedInUserId = user ? user.uid : null;
      this.cdr.detectChanges(); // Assicura che la UI si aggiorni se necessario
      this.loadLeaderboard(true);
    });
  }

  ngOnDestroy() {
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  /**
   * Gestisce il caricamento degli utenti per la classifica, sia al primo accesso che tramite scroll infinito.
   * @param isInitialLoad Indica se è il caricamento iniziale (true) o successivo (false).
   * @param event L'evento di scroll, fornito da `ion-infinite-scroll`.
   */
  loadLeaderboard(isInitialLoad: boolean, event?: any) {
    // ⭐ AGGIORNAMENTO: Aggiunta la condizione per il limite massimo ⭐
    if (this.allUsersLoaded && !isInitialLoad) {
      if (event) event.target.complete();
      return;
    }

    // ⭐ AGGIORNAMENTO: Se stiamo per superare il limite massimo, blocchiamo il caricamento ⭐
    if (this.leaderboardUsers.length >= this.maxLeaderboardSize) {
        this.allUsersLoaded = true;
        if (event) {
            event.target.complete();
            event.target.disabled = true; // Disabilita l'infinite scroll
        }
        this.isLoading = false; // Assicurati che isLoading sia false
        return;
    }


    this.isLoading = true;

    // ⭐ AGGIORNAMENTO: Calcola quanti utenti mancano al limite di 500 per l'ultima pagina ⭐
    const remainingUsers = this.maxLeaderboardSize - this.leaderboardUsers.length;
    const currentBatchSize = Math.min(this.pageSize, remainingUsers);

    // ⭐ AGGIORNAMENTO: Non fare la chiamata se non ci sono più utenti da caricare all'interno del limite ⭐
    if (currentBatchSize <= 0) {
      this.allUsersLoaded = true;
      this.isLoading = false;
      if (event) {
          event.target.complete();
          event.target.disabled = true;
      }
      return;
    }

    // Chiamata al servizio con la dimensione della pagina adattata
    // ⭐ AGGIORNAMENTO: Passa currentBatchSize al servizio ⭐
    this.usersSubscription = this.userDataService.getLeaderboardUsers(currentBatchSize, this.lastVisibleDoc)
      .subscribe({
        next: (response) => {
          // ⭐ AGGIORNAMENTO: Filtra i nuovi utenti per evitare duplicati in caso di ricaricamenti o glitch ⭐
          const newUsers = response.users.filter(newUser =>
            !this.leaderboardUsers.some(existingUser => existingUser.uid === newUser.uid)
          );

          if (isInitialLoad) {
            this.leaderboardUsers = newUsers;
          } else {
            this.leaderboardUsers = [...this.leaderboardUsers, ...newUsers];
          }

          // ⭐ AGGIORNAMENTO: Aggiorna lastVisibleDoc solo se sono stati caricati nuovi utenti e c'è un lastVisible ⭐
          if (response.users.length > 0) {
            this.lastVisibleDoc = response.lastVisible || undefined;
          } else {
            this.lastVisibleDoc = undefined; // Nessun nuovo documento, quindi non c'è un "dopo"
          }

          this.isLoading = false;

          // ⭐ AGGIORNAMENTO: Aggiorna allUsersLoaded se abbiamo caricato meno utenti del batch o raggiunto il limite ⭐
          if (newUsers.length < currentBatchSize || this.leaderboardUsers.length >= this.maxLeaderboardSize) {
            this.allUsersLoaded = true;
          }

          if (event) {
            event.target.complete();
            if (this.allUsersLoaded) {
              event.target.disabled = true;
            }
          }
        },
        error: (err) => {
          console.error('Errore durante il caricamento della classifica:', err);
          this.isLoading = false;
          if (event) event.target.complete();
        }
      });
  }

  /**
   * Metodo chiamato dall'evento `ionInfinite` del componente IonInfiniteScroll.
   * Avvia il caricamento dei dati successivi.
   * @param event L'evento di infinite scroll.
   */
  loadData(event: any) {
    this.loadLeaderboard(false, event);
  }

  /**
   * Restituisce il percorso dell'icona del trofeo in base alla posizione nella classifica.
   * @param index L'indice dell'utente nella lista (0 per il primo, 1 per il secondo, ecc.).
   * @returns Il percorso dell'immagine del trofeo o una stringa vuota se non è una delle prime tre posizioni.
   */
  getTrophy(index: number): string {
    if (index === 0) {
      return 'assets/immaginiGenerali/trophy-gold.png';
    } else if (index === 1) {
      return 'assets/immaginiGenerali/trophy-silver.png';
    } else if (index === 2) {
      return 'assets/immaginiGenerali/trophy-bronze.png';
    }
    return '';
  }

  getUserLevel(xp?: number): number {
    return this.expService.getLevelFromXP(xp !== undefined ? xp : 0);
  }

  /**
   * Se l'ID dell'utente cliccato corrisponde all'ID dell'utente loggato,
   * naviga al proprio profilo (/profilo). Altrimenti, naviga al profilo di altri utenti
   * passando l'ID dell'utente come parametro (/profilo-altri-utenti/:userId).
   * @param userId L'ID dell'utente il cui profilo deve essere visualizzato.
   */
  goToUserProfile(userId: string) {
    this.ngZone.run(() => {
      if (userId === this.loggedInUserId) {
        this.router.navigate(['/profilo']);
      } else {
        this.router.navigate(['/profilo-altri-utenti', userId]);
      }
    });
  }
}
