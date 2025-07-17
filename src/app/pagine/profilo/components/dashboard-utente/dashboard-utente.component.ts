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
  totalAlarmsCount: number = 0; // ⭐ CAMBIATO DA 'totalAlarmsCreated'
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
    this.subscriptions.add(
      this.expService.totalXP$.subscribe((totalXP: number) => {
        this.totalXP = totalXP;
        this.calculateLevelAndProgress();
        this.loadDashboardData();
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
        this.totalAlarmsCount = data.totalAlarmsCount ?? 0; // ⭐ CAMBIATO DA 'totalAlarmsCreated'
        this.lastAlarmInteraction = data.lastAlarmInteraction ?? '';

        this.totalNotesCount = data.totalNotesCount ?? 0;
        this.totalListsCount = data.totalListsCount ?? 0;
        this.incompleteListItems = data.incompleteListItems ?? 0;
        this.lastNoteListInteraction = data.lastNoteListInteraction ?? '';

        this.followersCount = data.followersCount ?? 0;
        this.followingCount = data.followingCount ?? 0;

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
    this.totalAlarmsCount = 0; // ⭐ CAMBIATO ANCHE QUI
    this.lastAlarmInteraction = '';
    this.totalNotesCount = 0;
    this.totalListsCount = 0;
    this.incompleteListItems = 0;
    this.lastNoteListInteraction = '';
    this.followersCount = 0;
    this.followingCount = 0;
    this.lastGlobalActivityTimestamp = '';
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

  getDisplayDate(dateString: string): string {
    if (!dateString) {
      return 'N/A';
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return date.toLocaleDateString('it-IT');
    } catch (e) {
      console.error("Errore nel parsing della data:", dateString, e);
      return 'N/A';
    }
  }
}
