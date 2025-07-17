// src/app/dashboard-utente/dashboard-utente.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard-utente',
  templateUrl: './dashboard-utente.component.html',
  styleUrls: ['./dashboard-utente.component.scss'],
  imports: [CommonModule],
})
export class DashboardUtenteComponent implements OnInit {

  // Dati di default per le sveglie
  activeAlarmsCount: number = 2;
  totalAlarmsCreated: number = 5;
  lastAlarmInteraction: string = 'Oggi, 10:30';

  // Dati di default per note e liste
  totalNotesCount: number = 8;
  totalListsCount: number = 3;
  incompleteListItems: number = 7;
  lastNoteListInteraction: string = 'Ieri, 18:00';

  // --- Nuovi dati per il sistema di livello ---
  userLevel: number = 1;
  currentXP: number = 0;
  totalXP: number = 0;
  xpForNextLevel: number = 100;
  progressPercentage: number = 0;

  // --- Nuovi dati per follower e seguiti ---
  followersCount: number = 0; // Inizializza a 0 o al valore caricato da Firebase
  followingCount: number = 0; // Inizializza a 0 o al valore caricato da Firebase

  // Mappa delle soglie XP per ogni livello
  private levelThresholds: { level: number, xpRequired: number }[] = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 100 },
    { level: 3, xpRequired: 350 }, // 100 + 250
    { level: 4, xpRequired: 850 }, // 350 + 500
    { level: 5, xpRequired: 1650 }, // 850 + 800
    { level: 6, xpRequired: 2850 }, // 1650 + 1200
    { level: 7, xpRequired: 4550 }, // 2850 + 1700
    { level: 8, xpRequired: 6850 }, // 4550 + 2300
    { level: 9, xpRequired: 9850 }, // 6850 + 3000
    { level: 10, xpRequired: 13850 }, // 9850 + 4000
    // Aggiungi altri livelli qui
  ];

  constructor() { }

  ngOnInit() {
    // Qui andrebbe la logica per caricare i dati reali da Firebase
    // Inizializziamo con dati di esempio per mostrare il funzionamento
    this.totalXP = 870; // Esempio: tra livello 3 e 4
    this.followersCount = 5; // Esempio
    this.followingCount = 12; // Esempio

    this.calculateLevelAndProgress();
  }

  // Metodo per aggiungere XP basato su un'azione
  addExperience(xpAmount: number): void {
    this.totalXP += xpAmount;
    this.calculateLevelAndProgress();
    // Qui dovresti anche salvare this.totalXP su Firebase!
  }

  // Metodo per calcolare il livello e il progresso
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
          // Se siamo all'ultimo livello definito, non c'è un prossimo livello specifico
          xpForNextLevelThreshold = this.totalXP; // O un valore molto alto per indicare "max level"
        }
        break;
      }
    }

    this.userLevel = currentLevel;
    this.currentXP = this.totalXP - xpForCurrentLevel;

    if (xpForNextLevelThreshold > xpForCurrentLevel) {
      this.xpForNextLevel = xpForNextLevelThreshold - xpForCurrentLevel;
      this.progressPercentage = (this.currentXP / this.xpForNextLevel) * 100;
    } else {
      // Caso in cui si è raggiunto il livello massimo o non c'è un prossimo livello definito
      this.xpForNextLevel = 0;
      this.progressPercentage = 100;
    }

    if (this.progressPercentage > 100) this.progressPercentage = 100;
  }

  // Esempio di come potresti chiamare addExperience da altri servizi o eventi
  // (Questi metodi dovrebbero essere chiamati da dove avvengono le azioni, es. un servizio)
  onAlarmCompleted(): void {
    this.addExperience(20);
    // Aggiorna anche activeAlarmsCount, totalAlarmsCreated, etc.
  }

  onTaskCompleted(): void {
    this.addExperience(15);
    // Aggiorna anche incompleteListItems, etc.
  }

  onNewFollower(): void {
    this.followersCount++;
    this.addExperience(25);
    // Salva this.followersCount su Firebase
  }

  onNewFollowing(): void {
    this.followingCount++;
    this.addExperience(10);
    // Salva this.followingCount su Firebase
  }
}
