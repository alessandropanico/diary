import { Component, OnInit, OnDestroy, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
import { IonInfiniteScroll } from '@ionic/angular';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { ExpService } from 'src/app/services/exp.service';
import { from, of } from 'rxjs'; // Aggiunto from e of
import { Router } from '@angular/router'; // ⭐ Importa Router
import { getAuth, User, onAuthStateChanged } from 'firebase/auth'; // ⭐



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


  private authSubscription!: Subscription; // ⭐ Per la sottoscrizione allo stato di autenticazione
  private loggedInUserId: string | null = null; // ⭐ Per memorizzare l'ID dell'utente loggato

  constructor(private userDataService: UserDataService,
    private expService: ExpService,
    private router: Router, // ⭐ Inietta Router
    private ngZone: NgZone, // ⭐ Per gestire l'esecuzione delle zone
    private cdr: ChangeDetectorRef // 👈 Aggiunto

  ) { } // Inietta il servizio

  ngOnInit() {
    // ⭐ Gestisci lo stato di autenticazione per ottenere loggedInUserId ⭐
    this.authSubscription = from(
      new Promise<User | null>(resolve => {
        const unsubscribe = onAuthStateChanged(getAuth(), user => {
          unsubscribe(); // Si disiscrive dopo il primo evento per non sprecare risorse
          resolve(user);
        });
      })
    ).subscribe(user => {
      this.loggedInUserId = user ? user.uid : null;
      this.cdr.detectChanges(); // Forza il rilevamento dei cambiamenti se loggedInUserId viene aggiornato
      this.loadLeaderboard(true); // Carica la classifica solo dopo aver ottenuto l'ID dell'utente loggato
    });
  }

  ngOnDestroy() {
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }
    if (this.authSubscription) { // ⭐ Disiscriviti anche dall'authSubscription
      this.authSubscription.unsubscribe();
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
     * ⭐⭐ NUOVA FUNZIONE: Naviga al profilo utente ⭐⭐
     * Se l'ID dell'utente cliccato corrisponde all'ID dell'utente loggato,
     * naviga al proprio profilo (/profilo). Altrimenti, naviga al profilo di altri utenti
     * passando l'ID dell'utente come parametro (/profilo-altri-utenti/:userId).
     * @param userId L'ID dell'utente il cui profilo deve essere visualizzato.
     */
  goToUserProfile(userId: string) {
    this.ngZone.run(() => { // Assicurati che la navigazione avvenga all'interno della zona Angular
      if (userId === this.loggedInUserId) {
        this.router.navigate(['/profilo']);
      } else {
        this.router.navigate(['/profilo-altri-utenti', userId]);
      }
    });
  }

}
