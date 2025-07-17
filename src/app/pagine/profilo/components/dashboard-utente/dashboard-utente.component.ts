// src/app/dashboard-utente/dashboard-utente.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpService } from 'src/app/services/exp.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service'; // Manteniamo l'import di UserDashboardCounts per tipizzare i dati recuperati
import { Subscription } from 'rxjs'; // Ancora utile per ExpService

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
    // Specifica che totalXP è di tipo 'number'
    this.subscriptions.add(
      this.expService.totalXP$.subscribe((totalXP: number) => {
        this.totalXP = totalXP;
        this.calculateLevelAndProgress();
      })
    );

    // **** CAMBIAMENTO FLESSIBILE QUI ****
    // Invece di sottoscriverti a un Observable (che non esiste),
    // carichiamo i dati della dashboard una volta sola all'avvio.
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // **** NUOVO METODO PER CARICARE I DATI DELLA DASHBOARD ****
  async loadDashboardData(): Promise<void> {
    try {
      // getUserData() nel tuo UserDataService restituisce 'any | null'.
      // Lo castiamo a UserDashboardCounts per ottenere la tipizzazione.
      const data = await this.userDataService.getUserData() as UserDashboardCounts | null;

      if (data) {
        this.activeAlarmsCount = data.activeAlarmsCount;
        this.totalAlarmsCreated = data.totalAlarmsCreated;
        this.lastAlarmInteraction = data.lastAlarmInteraction;
        this.totalNotesCount = data.totalNotesCount;
        this.totalListsCount = data.totalListsCount;
        this.incompleteListItems = data.incompleteListItems;
        this.lastNoteListInteraction = data.lastNoteListInteraction;
        this.followersCount = data.followersCount;
        this.followingCount = data.followingCount;

        // Assicurati di aggiornare totalXP anche da qui se non è già garantito da ExpService
        // (Il tuo UserDataService già chiama expService.setTotalXP() onAuthStateChanged,
        // quindi questo potrebbe essere ridondante ma non dannoso)
        // this.totalXP = (data as any).totalXP || 0;
        // this.calculateLevelAndProgress();
      } else {
        console.warn("Nessun dato dashboard trovato o utente non loggato.");
        // Puoi resettare i valori qui se preferisci che siano 0 quando non ci sono dati
        this.activeAlarmsCount = 0;
        this.totalAlarmsCreated = 0;
        this.lastAlarmInteraction = '';
        this.totalNotesCount = 0;
        this.totalListsCount = 0;
        this.incompleteListItems = 0;
        this.lastNoteListInteraction = '';
        this.followersCount = 0;
        this.followingCount = 0;
      }
    } catch (error) {
      console.error("Errore nel caricamento dei dati della dashboard:", error);
      // Gestisci l'errore, es. mostra un messaggio all'utente
    }
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
      this.xpForNextLevel = 0;
      this.progressPercentage = 100;
    }

    if (this.progressPercentage > 100) this.progressPercentage = 100;
  }
}
