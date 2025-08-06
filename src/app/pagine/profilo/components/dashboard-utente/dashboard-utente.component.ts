import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpService } from 'src/app/services/exp.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';
import { ProgettiService, Project } from 'src/app/services/progetti.service';

@Component({
  selector: 'app-dashboard-utente',
  templateUrl: './dashboard-utente.component.html',
  styleUrls: ['./dashboard-utente.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class DashboardUtenteComponent implements OnInit, OnDestroy {

  // Variabili per le metriche delle sveglie
  activeAlarmsCount: number = 0;
  totalAlarmsCount: number = 0;
  lastAlarmInteraction: string = '';

  // Variabili per le metriche di note e liste (esistenti)
  totalNotesCount: number = 0;
  totalListsCount: number = 0;
  incompleteListItems: number = 0; // Mantenuta
  lastNoteListInteraction: string = ''; // Mantenuta

  // ⭐ NUOVE VARIABILI PER LA SEPARAZIONE DI NOTE E TASK
  lastNoteInteraction: string = ''; // Ultima modifica specifica per le Note
  incompleteTaskItems: number = 0; // Task incompiute (se diversa da incompleteListItems)
  lastTaskInteraction: string = ''; // Ultima modifica specifica per le Task


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
  maxLevelReached: boolean = false;

  lastGlobalActivityTimestamp: string = '';

  private subscriptions: Subscription = new Subscription();

  // ⭐ NUOVE VARIABILI PER I PROGETTI ⭐
  totalProjectsCount: number = 0;
  lastProjectInteraction: string = '';


  constructor(
    private expService: ExpService,
    private userDataService: UserDataService,
    private progettiService: ProgettiService
  ) { }

  ngOnInit() {
    this.subscriptions.add(
      this.expService.getUserExpData().subscribe(expData => {
        this.totalXP = expData.totalXP;
        this.userLevel = expData.userLevel;
        this.currentXP = expData.currentXP;
        this.xpForNextLevel = expData.xpForNextLevel;
        this.progressPercentage = expData.progressPercentage;
        this.maxLevelReached = expData.maxLevelReached;
      })
    );
    this.loadDashboardData();
    // ⭐ Chiama il nuovo metodo per caricare i dati dei progetti ⭐
    this.loadProjectsData();
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

        // Dati esistenti per Note e Liste
        this.totalNotesCount = data.totalNotesCount ?? 0;
        this.totalListsCount = data.totalListsCount ?? 0;
        this.incompleteListItems = data.incompleteListItems ?? 0;
        this.lastNoteListInteraction = data.lastNoteListInteraction ?? '';

        // ⭐ NUOVI DATI PER LA SEPARAZIONE
        this.lastNoteInteraction = data.lastNoteInteraction ?? '';
        this.incompleteTaskItems = data.incompleteTaskItems ?? 0; // Se usi questo al posto di incompleteListItems per le task
        this.lastTaskInteraction = data.lastTaskInteraction ?? '';


        this.followersCount = data.followersCount ?? 0;
        this.followingCount = data.followingCount ?? 0;

        this.totalPhotosShared = data.totalPhotosShared ?? 0;
        this.lastPhotoSharedInteraction = data.lastPhotoSharedInteraction ?? '';

        this.lastGlobalActivityTimestamp = data.lastGlobalActivityTimestamp ?? '';

        this.diaryTotalWords = data.diaryTotalWords ?? 0;
        this.diaryLastInteraction = data.diaryLastInteraction ?? '';
        this.diaryEntryCount = data.diaryEntryCount ?? 0;

        // totalXP è gestito dalla sottoscrizione a expService.getUserExpData() in ngOnInit.
        // this.totalXP = data.totalXP ?? 0; // Non è più necessario qui se lo ricevi da expService
      } else {
        this.resetDashboardData();
      }
    } catch (error) {
      console.error("Errore durante il caricamento dei dati della dashboard:", error);
      this.resetDashboardData();
    }
  }

  // ⭐ METODO CORRETTO: Carica i dati relativi ai progetti ⭐
  loadProjectsData(): void {
    this.subscriptions.add(
      this.progettiService.getProjects().subscribe(projects => {
        this.totalProjectsCount = projects.length;

        if (projects.length > 0) {
          // Ordina i progetti in base all'ultimo aggiornamento per trovare il più recente
          const sortedProjects = projects.sort((a, b) => {
            const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            return dateB - dateA;
          });

          // ⭐ CONVERTI IL VALORE in stringa prima di assegnarlo
          this.lastProjectInteraction = sortedProjects[0].lastUpdated?.toISOString() ?? '';
        } else {
          this.lastProjectInteraction = '';
        }
      })
    );
  }

  resetDashboardData(): void {
    this.activeAlarmsCount = 0;
    this.totalAlarmsCount = 0;
    this.lastAlarmInteraction = '';

    // Reset dati esistenti
    this.totalNotesCount = 0;
    this.totalListsCount = 0;
    this.incompleteListItems = 0;
    this.lastNoteListInteraction = '';

    // ⭐ Reset nuovi dati
    this.lastNoteInteraction = '';
    this.incompleteTaskItems = 0;
    this.lastTaskInteraction = '';

    this.followersCount = 0;
    this.followingCount = 0;
    this.totalPhotosShared = 0;
    this.lastPhotoSharedInteraction = '';

    this.lastGlobalActivityTimestamp = '';
    this.diaryTotalWords = 0;
    this.diaryLastInteraction = '';
    this.diaryEntryCount = 0;

    this.userLevel = 1;
    this.currentXP = 0;
    this.xpForNextLevel = 100;
    this.totalXP = 0;
    this.progressPercentage = 0;
    this.maxLevelReached = false;

    this.totalProjectsCount = 0;
    this.lastProjectInteraction = '';
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
