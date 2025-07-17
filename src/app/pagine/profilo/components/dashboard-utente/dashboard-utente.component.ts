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

  // Variabili per le metriche delle sveglie
  activeAlarmsCount: number = 0;
  totalAlarmsCount: number = 0;
  lastAlarmInteraction: string = '';

  // Variabili per le metriche di note e liste
  totalNotesCount: number = 0;
  totalListsCount: number = 0;
  incompleteListItems: number = 0;
  lastNoteListInteraction: string = '';

  // Variabili per le metriche di social
  followersCount: number = 0;
  followingCount: number = 0;

  // ⭐ NUOVE VARIABILI PER LE FOTO CONDIVISE
  totalPhotosShared: number = 0; // Contatore per il numero totale di foto condivise
  lastPhotoSharedInteraction: string = ''; // Timestamp o data dell'ultima condivisione di una foto

  // Variabili per il sistema di XP/Livello
  userLevel: number = 1;
  currentXP: number = 0;
  xpForNextLevel: number = 100;
  totalXP: number = 0;
  progressPercentage: number = 0;

  lastGlobalActivityTimestamp: string = '';

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
    console.log("DashboardUtenteComponent: Inizializzazione del componente.");
    this.subscriptions.add(
      this.expService.totalXP$.subscribe((totalXP: number) => {
        this.totalXP = totalXP;
        console.log(`DashboardUtenteComponent: totalXP aggiornato a ${this.totalXP}`);
        this.calculateLevelAndProgress();
        console.log(`DashboardUtenteComponent: Dopo calculateLevelAndProgress - userLevel: ${this.userLevel}, currentXP: ${this.currentXP}, xpForNextLevel: ${this.xpForNextLevel}, progressPercentage: ${this.progressPercentage}%`);
      })
    );
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  async loadDashboardData(): Promise<void> {
    try {
      const data = await this.userDataService.getUserData() as UserDashboardCounts | null;

      if (data) {
        this.activeAlarmsCount = data.activeAlarmsCount ?? 0;
        this.totalAlarmsCount = data.totalAlarmsCount ?? 0;
        this.lastAlarmInteraction = data.lastAlarmInteraction ?? '';

        this.totalNotesCount = data.totalNotesCount ?? 0;
        this.totalListsCount = data.totalListsCount ?? 0;
        this.incompleteListItems = data.incompleteListItems ?? 0;
        this.lastNoteListInteraction = data.lastNoteListInteraction ?? '';

        this.followersCount = data.followersCount ?? 0;
        this.followingCount = data.followingCount ?? 0;

        // ⭐ INIZIALIZZA LE NUOVE VARIABILI CON I DATI (o 0/stringa vuota se non esistono ancora)
        this.totalPhotosShared = data.totalPhotosShared ?? 0;
        this.lastPhotoSharedInteraction = data.lastPhotoSharedInteraction ?? '';

        this.lastGlobalActivityTimestamp = data.lastGlobalActivityTimestamp ?? '';
      } else {
        console.warn("Nessun dato dashboard trovato o utente non loggato. Inizializzazione a zero.");
        this.resetDashboardData();
      }
    } catch (error) {
      console.error("Errore nel caricamento dei dati della dashboard:", error);
      this.resetDashboardData();
    }
  }

  resetDashboardData(): void {
    this.activeAlarmsCount = 0;
    this.totalAlarmsCount = 0;
    this.lastAlarmInteraction = '';
    this.totalNotesCount = 0;
    this.totalListsCount = 0;
    this.incompleteListItems = 0;
    this.lastNoteListInteraction = '';
    this.followersCount = 0;
    this.followingCount = 0;
    // ⭐ RESETTA ANCHE LE NUOVE VARIABILI
    this.totalPhotosShared = 0;
    this.lastPhotoSharedInteraction = '';

    this.lastGlobalActivityTimestamp = '';
  }

  calculateLevelAndProgress(): void {
    console.log(`calculateLevelAndProgress chiamato con totalXP: ${this.totalXP}`);
    let xpRequiredForCurrentLevel = 0;
    let xpRequiredForNextLevelThreshold = 0;
    let currentLevel = 1;

    for (let i = this.levelThresholds.length - 1; i >= 0; i--) {
      if (this.totalXP >= this.levelThresholds[i].xpRequired) {
        currentLevel = this.levelThresholds[i].level;
        xpRequiredForCurrentLevel = this.levelThresholds[i].xpRequired;

        if (i + 1 < this.levelThresholds.length) {
          xpRequiredForNextLevelThreshold = this.levelThresholds[i + 1].xpRequired;
        } else {
          xpRequiredForNextLevelThreshold = this.totalXP;
        }
        break;
      }
    }

    this.userLevel = currentLevel;
    this.currentXP = this.totalXP - xpRequiredForCurrentLevel;

    const totalXpSpanForCurrentLevel = xpRequiredForNextLevelThreshold - xpRequiredForCurrentLevel;

    if (totalXpSpanForCurrentLevel > 0) {
      this.xpForNextLevel = totalXpSpanForCurrentLevel - this.currentXP;
      this.progressPercentage = (this.currentXP / totalXpSpanForCurrentLevel) * 100;
    } else {
      this.xpForNextLevel = 0;
      this.progressPercentage = 100;
    }

    if (this.progressPercentage > 100) {
      this.progressPercentage = 100;
    }
  }

  getDisplayDate(dateString: string): string {
    if (!dateString) {
      return 'N/A';
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return date.toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
      console.error("Errore nel parsing della data:", dateString, e);
      return 'N/A';
    }
  }
}
