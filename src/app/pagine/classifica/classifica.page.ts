import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { IonInfiniteScroll } from '@ionic/angular';
// Importa UserDataService e UserDashboardCounts (già corretto)
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

  // Usa l'interfaccia corretta (già corretto, ma la riaffermazione non fa male)
  leaderboardUsers: UserDashboardCounts[] = [];
  isLoading: boolean = false; // Controlla lo spinner di caricamento
  private usersSubscription!: Subscription; // Per disiscriversi dagli Observable

  // La variabile ora può essere o un QueryDocumentSnapshot o 'undefined'
  // ⭐ Non ci sono modifiche qui, è già corretto con 'undefined' ⭐
  private lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | undefined = undefined;

  private pageSize: number = 10; // Quanti utenti caricare per volta
  public allUsersLoaded: boolean = false; // Indica se abbiamo caricato tutti gli utenti disponibili

  constructor(private userDataService: UserDataService) { } // Inietta il servizio

  ngOnInit() {
    this.loadLeaderboard(true); // Carica la prima pagina all'inizializzazione
  }

  ngOnDestroy() {
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe(); // Pulizia della sottoscrizione
    }
  }

  /**
   * Gestisce il caricamento degli utenti per la classifica, sia al primo accesso che tramite scroll infinito.
   * @param isInitialLoad Indica se è il caricamento iniziale (true) o successivo (false).
   * @param event L'evento di scroll, fornito da `ion-infinite-scroll`.
   */
  loadLeaderboard(isInitialLoad: boolean, event?: any) {
    // Non caricare se tutti gli utenti sono già stati caricati e non è un caricamento iniziale
    if (this.allUsersLoaded && !isInitialLoad) {
      if (event) event.target.complete();
      return;
    }

    this.isLoading = true; // Imposta lo stato di caricamento

    // Chiamata al servizio per recuperare gli utenti
    // La chiamata è già coerente con il servizio aggiornato (lastDoc? QueryDocumentSnapshot)
    this.usersSubscription = this.userDataService.getLeaderboardUsers(this.pageSize, this.lastVisibleDoc)
      .subscribe({
        next: (response) => {
          if (isInitialLoad) {
            this.leaderboardUsers = response.users; // Per il primo caricamento, sovrascrivi
          } else {
            this.leaderboardUsers = [...this.leaderboardUsers, ...response.users]; // Aggiungi ai risultati esistenti
          }

          // Quando salvi il risultato, potresti ricevere 'null' da Firestore.
          // L'operatore '?? undefined' assicura che se 'response.lastVisible' è null,
          // la nostra variabile riceva 'undefined', mantenendo la coerenza.
          // ⭐ Non ci sono modifiche qui, è già corretto ⭐
          this.lastVisibleDoc = response.lastVisible ?? undefined;
          this.isLoading = false;

          // Se il numero di utenti restituiti è minore di pageSize, abbiamo raggiunto la fine
          if (response.users.length < this.pageSize) {
            this.allUsersLoaded = true;
          }

          if (event) {
            event.target.complete(); // Segnala a Infinite Scroll che il caricamento è completato
            if (this.allUsersLoaded) {
              event.target.disabled = true; // Disabilita Infinite Scroll se tutti gli utenti sono stati caricati
            }
          }
        },
        error: (err) => {
          console.error('Errore durante il caricamento della classifica:', err);
          this.isLoading = false;
          if (event) event.target.complete(); // Assicurati di completare l'evento anche in caso di errore
          // Potresti mostrare un toast o un alert all'utente
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
