// src/app/components/user-dashboard/user-dashboard.component.ts

import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpService } from 'src/app/services/exp.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Subscription, of } from 'rxjs'; // Aggiunto 'of' per i casi in cui non c'è userId
import { catchError } from 'rxjs/operators';
import { getAuth } from '@angular/fire/auth'; // Importa getAuth se usi Firebase Auth

@Component({
  selector: 'app-user-dashboard', // Nuovo selettore
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss'], // Userà lo stesso SCSS
  standalone: true,
  imports: [CommonModule],
})
export class UserDashboardComponent implements OnInit, OnDestroy, OnChanges {

  // ⭐ INPUT PROPERTY per l'ID dell'utente di cui mostrare la dashboard ⭐
  @Input() userId!: string;

  // Variabili per le metriche
  activeAlarmsCount: number = 0;
  totalAlarmsCount: number = 0;
  lastAlarmInteraction: string = '';

  totalNotesCount: number = 0;
  totalListsCount: number = 0;
  incompleteTaskItems: number = 0;
  lastNoteInteraction: string = '';
  lastTaskInteraction: string = '';

  followersCount: number = 0;
  followingCount: number = 0;

  totalPhotosShared: number = 0;
  lastPhotoSharedInteraction: string = '';

  diaryTotalWords: number = 0;
  diaryLastInteraction: string = '';
  diaryEntryCount: number = 0;

  userLevel: number = 1;
  currentXP: number = 0;
  xpForNextLevel: number = 100;
  totalXP: number = 0;
  progressPercentage: number = 0;
  maxLevelReached: boolean = false;

  lastGlobalActivityTimestamp: string = '';

  // Stato di caricamento
  isLoading: boolean = true;

  private subscriptions: Subscription = new Subscription();

  constructor(
    private expService: ExpService,
    private userDataService: UserDataService
  ) { }

  ngOnInit() {
    // La sottoscrizione a getUserExpData() del servizio expService
    // deve essere modificata o gestita diversamente.
    // ExpService probabilmente fornisce XP dell'utente corrente.
    // Per un utente terzo, dovresti avere un metodo in ExpService
    // come `getUserExpDataByUid(userId: string)` o gestirlo qui.
    // Per ora, manterrò la logica originale, ma tieni presente questa potenziale differenza.
    this.subscriptions.add(
      this.expService.getUserExpData().subscribe(expData => {
        // Questi dati potrebbero non essere quelli dell'utente visitato,
        // ma dell'utente LOGGATO.
        // Se ExpService è globale e non filtra per utente,
        // dovrai modificarlo per filtrare per this.userId.
        this.totalXP = expData.totalXP;
        this.userLevel = expData.userLevel;
        this.currentXP = expData.currentXP;
        this.xpForNextLevel = expData.xpForNextLevel;
        this.progressPercentage = expData.progressPercentage;
        this.maxLevelReached = expData.maxLevelReached;
      })
    );
    // Non chiamare loadDashboardData qui, aspetta ngOnChanges
  }

  // ⭐ Implementazione di OnChanges per reagire ai cambiamenti dell'Input userId ⭐
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userId'] && changes['userId'].currentValue !== changes['userId'].previousValue) {
      if (this.userId) {
        console.log('UserDashboardComponent: userId cambiato/ricevuto:', this.userId);
        this.loadDashboardData();
      } else {
        console.warn('UserDashboardComponent: userId non valido, impossibile caricare la dashboard.');
        this.resetDashboardData();
        this.isLoading = false;
      }
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  async loadDashboardData(): Promise<void> {
    if (!this.userId) {
      console.warn('loadDashboardData: userId non disponibile.');
      this.resetDashboardData();
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    try {
      // ⭐ CHIAMATA AL SERVIZIO PER RECUPERARE DATI DI UN UTENTE SPECIFICO ⭐
      // NOTA: Assicurati che il tuo UserDataService abbia un metodo getUserDataByUid(uid: string)
      const data = await this.userDataService.getUserDataByUid(this.userId) as UserDashboardCounts | null;

      if (data) {
        this.activeAlarmsCount = data.activeAlarmsCount ?? 0;
        this.totalAlarmsCount = data.totalAlarmsCount ?? 0;
        this.lastAlarmInteraction = data.lastAlarmInteraction ?? '';

        this.totalNotesCount = data.totalNotesCount ?? 0;
        this.totalListsCount = data.totalListsCount ?? 0;
        this.incompleteTaskItems = data.incompleteTaskItems ?? 0;
        this.lastNoteInteraction = data.lastNoteInteraction ?? '';
        this.lastTaskInteraction = data.lastTaskInteraction ?? '';

        this.followersCount = data.followersCount ?? 0;
        this.followingCount = data.followingCount ?? 0;

        this.totalPhotosShared = data.totalPhotosShared ?? 0;
        this.lastPhotoSharedInteraction = data.lastPhotoSharedInteraction ?? '';

        this.lastGlobalActivityTimestamp = data.lastGlobalActivityTimestamp ?? '';

        this.diaryTotalWords = data.diaryTotalWords ?? 0;
        this.diaryLastInteraction = data.diaryLastInteraction ?? '';
        this.diaryEntryCount = data.diaryEntryCount ?? 0;

        // Recupera i dati XP per questo utente specifico
        // Se il tuo ExpService non ha un metodo `getUserExpDataByUid`,
        // dovrai aggiungerlo o recuperare questi dati direttamente qui.
        // Ad esempio, se UserDashboardCounts include anche i dati XP dell'utente,
        // puoi usarli direttamente da 'data'.
        // Altrimenti, simulo il recupero XP per l'utente specifico:
        const expData = await this.expService.getUserExpDataByUid(this.userId).pipe(
          catchError(err => {
            console.error('Errore nel recupero dati EXP per utente:', err);
            return of({
              totalXP: 0, userLevel: 1, currentXP: 0, xpForNextLevel: 100, progressPercentage: 0, maxLevelReached: false
            }); // Ritorna dati di fallback
          })
        ).toPromise(); // Converti Observable in Promise per usarlo con await

        this.totalXP = expData?.totalXP ?? 0;
        this.userLevel = expData?.userLevel ?? 1;
        this.currentXP = expData?.currentXP ?? 0;
        this.xpForNextLevel = expData?.xpForNextLevel ?? 100;
        this.progressPercentage = expData?.progressPercentage ?? 0;
        this.maxLevelReached = expData?.maxLevelReached ?? false;


      } else {
        this.resetDashboardData();
      }
    } catch (error) {
      console.error("Errore durante il caricamento dei dati della dashboard per utente:", error);
      this.resetDashboardData();
    } finally {
      this.isLoading = false;
    }
  }

  resetDashboardData(): void {
    this.activeAlarmsCount = 0;
    this.totalAlarmsCount = 0;
    this.lastAlarmInteraction = '';

    this.totalNotesCount = 0;
    this.totalListsCount = 0;
    this.incompleteTaskItems = 0;
    this.lastNoteInteraction = '';
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
