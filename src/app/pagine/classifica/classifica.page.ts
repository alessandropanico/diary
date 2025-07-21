import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { IonInfiniteScroll } from '@ionic/angular';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

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

  // ⭐ MODIFICA QUI: CAMBIAMO 'null' CON 'undefined' ⭐
  // La variabile ora può essere o un QueryDocumentSnapshot o 'undefined'
  private lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | undefined = undefined;

  private pageSize: number = 10;
  public allUsersLoaded: boolean = false;

  constructor(private userDataService: UserDataService) { }

  ngOnInit() {
    this.loadLeaderboard(true);
  }

  ngOnDestroy() {
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }
  }

  /**
   * Gestisce il caricamento degli utenti per la classifica, sia al primo accesso che tramite scroll infinito.
   * @param isInitialLoad Indica se è il caricamento iniziale (true) o successivo (false).
   * @param event L'evento di scroll, fornito da `ion-infinite-scroll`.
   */
  loadLeaderboard(isInitialLoad: boolean, event?: any) {
    if (this.allUsersLoaded && !isInitialLoad) {
      if (event) event.target.complete();
      return;
    }

    this.isLoading = true;

    // La chiamata qui è ora coerente: passi 'undefined' per il primo caricamento
    // o un QueryDocumentSnapshot per quelli successivi.
    this.usersSubscription = this.userDataService.getLeaderboardUsers(this.pageSize, this.lastVisibleDoc)
      .subscribe({
        next: (response) => {
          if (isInitialLoad) {
            this.leaderboardUsers = response.users;
          } else {
            this.leaderboardUsers = [...this.leaderboardUsers, ...response.users];
          }

          // Quando salvi il risultato, potresti ricevere 'null' da Firestore
          // È importante che la variabile possa accettarlo, ma la coerenza iniziale è con 'undefined'
          // L'operatore '?? undefined' assicura che se 'response.lastVisible' è null,
          // la nostra variabile riceva 'undefined', mantenendo la coerenza.
          this.lastVisibleDoc = response.lastVisible ?? undefined;
          this.isLoading = false;

          if (response.users.length < this.pageSize) {
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
      return 'assets/icons/trophy-gold.png';
    } else if (index === 1) {
      return 'assets/icons/trophy-silver.png';
    } else if (index === 2) {
      return 'assets/icons/trophy-bronze.png';
    }
    return '';
  }
}
