import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpService } from 'src/app/services/exp.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard-utente',
  templateUrl: './dashboard-utente.component.html',
  styleUrls: ['./dashboard-utente.component.scss'],
  standalone: true, // ⭐ Potrebbe essere necessaria se usi Angular 15+ e non lo è già
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

  // NUOVE VARIABILI PER LE FOTO CONDIVISE
  totalPhotosShared: number = 0;
  lastPhotoSharedInteraction: string = '';

  // ⭐ NUOVE VARIABILI PER IL DIARIO
  diaryTotalWords: number = 0;
  diaryLastInteraction: string = '';
  diaryEntryCount: number = 0;

  // Variabili relative al livello utente, ora popolate da ExpService
  userLevel: number = 1;
  currentXP: number = 0;
  xpForNextLevel: number = 100;
  totalXP: number = 0;
  progressPercentage: number = 0;
  // ⭐ NUOVO: Variabile per indicare se l'utente ha raggiunto il livello massimo
  maxLevelReached: boolean = false;

  lastGlobalActivityTimestamp: string = '';

  // ⭐ RIMOSSO: levelThresholds non è più necessario qui, la logica è in ExpService
  // private levelThresholds: { level: number, xpRequired: number }[] = [...];

  private subscriptions: Subscription = new Subscription();

  constructor(
    private expService: ExpService,
    private userDataService: UserDataService
  ) { }

  ngOnInit() {
    this.subscriptions.add(
      // ⭐ MODIFICATO: Sottoscrizione a getUserExpData() per ottenere tutti i dati XP e livello pre-calcolati
      this.expService.getUserExpData().subscribe(expData => {
        this.totalXP = expData.totalXP;
        this.userLevel = expData.userLevel;
        this.currentXP = expData.currentXP;
        this.xpForNextLevel = expData.xpForNextLevel;
        this.progressPercentage = expData.progressPercentage;
        this.maxLevelReached = expData.maxLevelReached; // ⭐ NOVITÀ: Assegna il valore di maxLevelReached
      })
    );
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  async loadDashboardData(): Promise<void> {
    try {
      // Nota: Non passiamo totalXP direttamente da qui a ExpService,
      // perché ExpService si abbona al totalXP salvato in UserDataService
      // tramite onAuthStateChanged e la sua logica interna.
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

        this.totalPhotosShared = data.totalPhotosShared ?? 0;
        this.lastPhotoSharedInteraction = data.lastPhotoSharedInteraction ?? '';

        this.lastGlobalActivityTimestamp = data.lastGlobalActivityTimestamp ?? '';

        // ⭐ POPOLA LE NUOVE VARIABILI DEL DIARIO
        this.diaryTotalWords = data.diaryTotalWords ?? 0;
        this.diaryLastInteraction = data.diaryLastInteraction ?? '';
        this.diaryEntryCount = data.diaryEntryCount ?? 0;

        // totalXP è gestito dalla sottoscrizione a expService.getUserExpData() in ngOnInit.
        // Non è più necessario leggerlo direttamente qui da data.
      } else {
        this.resetDashboardData();
      }
    } catch (error) {
      console.error("Errore durante il caricamento dei dati della dashboard:", error);
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
    this.totalPhotosShared = 0;
    this.lastPhotoSharedInteraction = '';

    this.lastGlobalActivityTimestamp = '';
    // ⭐ RESETTA LE NUOVE VARIABILI DEL DIARIO
    this.diaryTotalWords = 0;
    this.diaryLastInteraction = '';
    this.diaryEntryCount = 0;

    // Queste variabili di livello verranno comunque aggiornate dalla sottoscrizione a ExpService
    // ma un reset qui può aiutare per una coerenza visiva iniziale.
    this.userLevel = 1;
    this.currentXP = 0;
    this.xpForNextLevel = 100;
    this.totalXP = 0;
    this.progressPercentage = 0;
    this.maxLevelReached = false; // ⭐ NOVITÀ: Resetta anche questa
  }

  // ⭐ RIMOSSO: calculateLevelAndProgress() non è più necessario qui.
  // La logica è stata spostata interamente in ExpService e i risultati vengono ricevuti tramite Observable.
  // calculateLevelAndProgress(): void { ... }

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
