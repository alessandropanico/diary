// src/app/dashboard-utente/dashboard-utente.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpService } from 'src/app/services/exp.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard-utente',
  templateUrl: './dashboard-utente.component.html',
  styleUrls: ['./dashboard-utente.component.scss'],
  imports: [CommonModule],
})
export class DashboardUtenteComponent implements OnInit, OnDestroy {

  activeAlarmsCount: number = 0;
  totalAlarmsCreated: number = 0;
  lastAlarmInteraction: string = '';

  totalNotesCount: number = 0;
  totalListsCount: number = 0;
  incompleteListItems: number = 0;
  lastNoteListInteraction: string = '';

  followersCount: number = 0;
  followingCount: number = 0;

  userLevel: number = 1;
  currentXP: number = 0;
  totalXP: number = 0;
  xpForNextLevel: number = 100;
  progressPercentage: number = 0;

  private levelThresholds: { level: number, xpRequired: number }[] = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 100 },
    { level: 3, xpRequired: 350 },
    { level: 4, xpRequired: 850 },
    { level: 5, xpRequired: 1650 },
    { level: 6, xpRequired: 2850 },
    { level: 7, xpRequired: 4550 },
    { level: 8, xpRequired: 6850 },
    { level: 9, xpRequired: 9850 },
    { level: 10, xpRequired: 13850 },
  ];

  private subscriptions: Subscription = new Subscription();

  constructor(
    private expService: ExpService,
    private userDataService: UserDataService
  ) { }

  ngOnInit() {
    // Sottoscriviti a totalXP$ per aggiornamenti in tempo reale dell'XP e del livello.
    // Quando gli XP cambiano, ricarica tutti i dati della dashboard.
    this.subscriptions.add(
      this.expService.totalXP$.subscribe((totalXP: number) => {
        this.totalXP = totalXP;
        this.calculateLevelAndProgress();
        // ⭐ CHIAMATA CHIAVE: Aggiorna tutti i dati della dashboard quando l'XP cambia.
        this.loadDashboardData();
      })
    );

    // Carica i dati della dashboard al primo caricamento del componente.
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  /**
   * Carica tutti i dati relativi alla dashboard dall'User Data Service.
   * Questo metodo viene chiamato all'inizializzazione del componente e
   * ogni volta che il totalXP cambia, per garantire che i dati siano aggiornati.
   */
  async loadDashboardData(): Promise<void> {
    try {
      // Recupera i dati dal servizio.
      // Assicurati che i valori siano numeri/stringhe validi usando l'operatore nullish coalescing (??).
      const data = await this.userDataService.getUserData() as UserDashboardCounts | null;

      if (data) {
        this.activeAlarmsCount = data.activeAlarmsCount ?? 0;
        this.totalAlarmsCreated = data.totalAlarmsCreated ?? 0;
        this.lastAlarmInteraction = data.lastAlarmInteraction ?? '';

        this.totalNotesCount = data.totalNotesCount ?? 0;
        this.totalListsCount = data.totalListsCount ?? 0;
        this.incompleteListItems = data.incompleteListItems ?? 0;
        this.lastNoteListInteraction = data.lastNoteListInteraction ?? '';

        this.followersCount = data.followersCount ?? 0;
        this.followingCount = data.followingCount ?? 0;

        // totalXP è già gestito dalla sottoscrizione a expService.totalXP$,
        // quindi non è necessario aggiornarlo di nuovo qui per evitare ridondanze.
      } else {
        console.warn("Nessun dato dashboard trovato o utente non loggato. Inizializzazione a zero.");
        this.resetDashboardData();
      }
    } catch (error) {
      console.error("Errore nel caricamento dei dati della dashboard:", error);
      this.resetDashboardData(); // Resetta i dati in caso di errore per pulizia.
    }
  }

  /**
   * Resetta tutte le proprietà della dashboard a valori iniziali (zero/stringa vuota).
   * Utile quando non ci sono dati utente o in caso di errore di caricamento.
   */
  resetDashboardData(): void {
    this.activeAlarmsCount = 0;
    this.totalAlarmsCreated = 0;
    this.lastAlarmInteraction = '';
    this.totalNotesCount = 0;
    this.totalListsCount = 0;
    this.incompleteListItems = 0;
    this.lastNoteListInteraction = '';
    this.followersCount = 0;
    this.followingCount = 0;
    // Non resettiamo this.totalXP qui, poiché è gestito direttamente da ExpService.
  }

  calculateLevelAndProgress(): void {
    let currentLevel = 1;
    let xpForCurrentLevel = 0;
    let xpForNextLevelThreshold = 0;

    for (let i = this.levelThresholds.length - 1; i >= 0; i--) {
      if (this.totalXP >= this.levelThresholds[i].xpRequired) {
        currentLevel = this.levelThresholds[i].level;
        xpForCurrentLevel = this.levelThresholds[i].xpRequired;
        if (i + 1 < this.levelThresholds.length) {
          xpForNextLevelThreshold = this.levelThresholds[i + 1].xpRequired;
        } else {
          // Se siamo all'ultimo livello definito, non c'è un "prossimo" livello per XP.
          // Imposta un valore che mostri il progresso completato o l'XP attuale.
          xpForNextLevelThreshold = this.totalXP + 1;
        }
        break;
      }
    }

    this.userLevel = currentLevel;
    this.currentXP = this.totalXP - xpForCurrentLevel;

    if (xpForNextLevelThreshold > xpForCurrentLevel) {
      this.xpForNextLevel = xpForNextLevelThreshold - xpForCurrentLevel;
      this.progressPercentage = this.xpForNextLevel > 0 ? (this.currentXP / this.xpForNextLevel) * 100 : 100;
    } else {
      this.xpForNextLevel = 0; // Già al livello massimo o non c'è un prossimo livello definito.
      this.progressPercentage = 100; // Progresso completato.
    }

    if (this.progressPercentage > 100) this.progressPercentage = 100;
  }

  /**
   * Formatta una stringa di data nel formato 'dd/MM/yyyy' o restituisce 'N/A' se non valida.
   * @param dateString La stringa di data (es. ISO string).
   * @returns La data formattata o 'N/A'.
   */
  getDisplayDate(dateString: string): string {
    if (!dateString) {
      return 'N/A';
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) { // Controlla se la data è valida.
        return 'N/A';
      }
      return date.toLocaleDateString('it-IT');
    } catch (e) {
      console.error("Errore nel parsing della data:", dateString, e);
      return 'N/A';
    }
  }
}
