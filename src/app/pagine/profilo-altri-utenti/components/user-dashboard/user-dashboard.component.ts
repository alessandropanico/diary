// src/app/components/user-dashboard/user-dashboard.component.ts

import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpService } from 'src/app/services/exp.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { getAuth } from '@angular/fire/auth';
import { ProgettiService, Project } from 'src/app/services/progetti.service'; // ⭐ Aggiunto ProgettiService e Project ⭐

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class UserDashboardComponent implements OnInit, OnDestroy, OnChanges {

  @Input() userId!: string;

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

  isLoading: boolean = true;

  private subscriptions: Subscription = new Subscription();

  // ⭐ NUOVE VARIABILI PER I PROGETTI ⭐
  totalProjectsCount: number = 0;
  lastProjectInteraction: string = '';

  constructor(
    private expService: ExpService,
    private userDataService: UserDataService,
    private progettiService: ProgettiService // ⭐ Iniettato il servizio ⭐
  ) { }

  ngOnInit() {
    // La logica di caricamento è spostata in ngOnChanges
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userId'] && changes['userId'].currentValue !== changes['userId'].previousValue) {
      if (this.userId) {
        console.log('UserDashboardComponent: userId cambiato/ricevuto:', this.userId);
        this.loadDashboardData();
        this.loadProjectsData(); // ⭐ Chiamata al nuovo metodo per i progetti ⭐
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
       
        const expData = await this.expService.getUserExpDataByUid(this.userId).pipe(
          catchError(err => {
            console.error('Errore nel recupero dati EXP per utente:', err);
            return of({
              totalXP: 0, userLevel: 1, currentXP: 0, xpForNextLevel: 100, progressPercentage: 0, maxLevelReached: false
            });
          })
        ).toPromise();
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

  // ⭐ NUOVO METODO: Carica i dati relativi ai progetti per l'utente specifico ⭐
  loadProjectsData(): void {
    this.subscriptions.add(
      this.progettiService.getProjectsByUid(this.userId).subscribe(projects => {
        this.totalProjectsCount = projects.length;
        if (projects.length > 0) {
          const sortedProjects = projects.sort((a, b) => {
            const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            return dateB - dateA;
          });
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
    // ⭐ Reset delle nuove variabili per i progetti ⭐
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
