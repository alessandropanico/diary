import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';
import { DiaryService, DailyEntry } from 'src/app/services/diary.service';
import { ExpService } from 'src/app/services/exp.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';
import { getAuth } from 'firebase/auth';
import { Chart, registerables } from 'chart.js'; // Importa Chart e registerables

// Registra tutti i componenti di Chart.js (necessario per Ionic/Angular)
Chart.register(...registerables);

interface HighlightedDate {
  date: string;
  textColor?: string;
  backgroundColor?: string;
}

@Component({
  selector: 'app-diario',
  templateUrl: './diario.page.html',
  styleUrls: ['./diario.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiarioPage implements OnInit, OnDestroy {

  @ViewChild('moodChartCanvas') moodChartCanvas!: ElementRef;
  moodChart: Chart | undefined;

  selectedDate: Date = new Date();
  selectedDateString: string = '';
  todayString: string = this.formatDate(new Date());

  currentEntry: DailyEntry = {
    date: '',
    mood: '',
    note: '',
    energyLevel: 0,
    sleepQuality: '',
    stressLevel: 0,
    focusHours: undefined
  };

  initialEntryState: DailyEntry | null = null;
  hasChanges: boolean = false;

  private authStateUnsubscribe: (() => void) | undefined;
  private userId: string | null = null;
  private currentEntrySubscription: Subscription | undefined;
  recentEntries: DailyEntry[] = [];
  highlightedDatesConfig: HighlightedDate[] = [];

  constructor(
    private diaryService: DiaryService,
    private expService: ExpService,
    private userDataService: UserDataService,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.authStateUnsubscribe = getAuth().onAuthStateChanged(user => {
      if (user) {
        this.userId = user.uid;
        this.initializeDate();
        this.loadRecentEntries();
        this.loadHighlightedDates();
      } else {
        this.userId = null;
        this.resetCurrentEntry();
        this.initialEntryState = null;
        this.hasChanges = false;
        this.recentEntries = [];
        this.highlightedDatesConfig = [];
        this.expService.setTotalXP(0);
        this.destroyChart(); // Distruggi il grafico quando l'utente si disconnette
      }
    });
  }

  ngOnDestroy(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    if (this.currentEntrySubscription) {
      this.currentEntrySubscription.unsubscribe();
    }
    this.destroyChart(); // Distruggi il grafico alla distruzione del componente
  }

  private resetCurrentEntry(date: string = this.formatDate(new Date())) {
    this.currentEntry = {
      date: date,
      mood: '',
      note: '',
      energyLevel: 0,
      sleepQuality: '',
      stressLevel: 0,
      focusHours: undefined
    };
  }

  initializeDate() {
    this.selectedDate = new Date();
    this.selectedDateString = this.formatDate(this.selectedDate);
    this.loadDailyEntry(this.selectedDateString);
  }

  onDateChange() {
    this.selectedDate = new Date(this.selectedDateString);
    this.loadDailyEntry(this.selectedDateString);
  }

  previousDay() {
    this.selectedDate.setDate(this.selectedDate.getDate() - 1);
    this.selectedDateString = this.formatDate(this.selectedDate);
    this.loadDailyEntry(this.selectedDateString);
  }

  nextDay() {
    this.selectedDate.setDate(this.selectedDate.getDate() + 1);
    this.selectedDateString = this.formatDate(this.selectedDate);
    this.loadDailyEntry(this.selectedDateString);
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async loadDailyEntry(date: string) {
    if (!this.userId) {
      this.resetCurrentEntry(date);
      this.initialEntryState = null;
      this.hasChanges = false;
      return;
    }

    this.currentEntrySubscription?.unsubscribe();
    this.currentEntrySubscription = this.diaryService.getDailyEntry(this.userId, date).subscribe({
      next: (entry) => {
        const validSleepQualities = ['scarso', 'medio', 'ottimo'];
        const loadedSleepQuality = entry?.sleepQuality && validSleepQualities.includes(entry.sleepQuality)
          ? entry.sleepQuality as 'scarso' | 'medio' | 'ottimo'
          : '';

        this.currentEntry = {
          date: date,
          mood: entry?.mood ?? '',
          note: entry?.note ?? '',
          energyLevel: entry?.energyLevel ?? 0,
          sleepQuality: loadedSleepQuality,
          stressLevel: entry?.stressLevel ?? 0,
          focusHours: entry?.focusHours ?? undefined
        };
        this.initialEntryState = JSON.parse(JSON.stringify(this.currentEntry));
        this.hasChanges = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Errore nel caricamento della voce del diario:', error);
        this.presentAlert('Errore', 'Impossibile caricare la voce del diario.');
        this.resetCurrentEntry(date);
        this.initialEntryState = null;
        this.hasChanges = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadRecentEntries() {
    if (!this.userId) {
      this.recentEntries = [];
      this.renderMoodChart(); // Aggiorna il grafico anche se non ci sono dati
      return;
    }
    this.diaryService.getRecentDailyEntries(this.userId, 7).subscribe({
      next: (entries) => {
        this.recentEntries = entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Ordina per data
        this.renderMoodChart(); // Renderizza il grafico dopo aver caricato i dati
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Errore nel caricamento delle voci recenti:', error);
      }
    });
  }

  loadHighlightedDates() {
    if (!this.userId) {
      this.highlightedDatesConfig = [];
      return;
    }

    this.diaryService.getAllDiaryDates(this.userId).subscribe({
      next: (dates: string[]) => {
        this.highlightedDatesConfig = dates.map(dateString => ({
          date: dateString,
          textColor: '#FFF',
          backgroundColor: '#005f73'
        }));
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Errore nel caricamento delle date evidenziate:', error);
      }
    });
  }

  selectMood(mood: string) {
    if (this.currentEntry.mood === mood) {
      this.currentEntry.mood = '';
    } else {
      this.currentEntry.mood = mood;
    }
    this.markAsChanged();
    this.cdr.detectChanges();
  }

  selectSleepQuality(quality: 'scarso' | 'medio' | 'ottimo') {
    if (this.currentEntry.sleepQuality === quality) {
      this.currentEntry.sleepQuality = '';
    } else {
      this.currentEntry.sleepQuality = quality;
    }
    this.markAsChanged();
    this.cdr.detectChanges();
  }

  markAsChanged() {
    if (this.initialEntryState === null) {
      const defaultEmptyEntry: DailyEntry = {
        date: this.currentEntry.date,
        mood: '',
        note: '',
        energyLevel: 0,
        sleepQuality: '',
        stressLevel: 0,
        focusHours: undefined
      };
      this.hasChanges = JSON.stringify(this.currentEntry) !== JSON.stringify(defaultEmptyEntry);
      this.cdr.detectChanges();
      return;
    }

    const current = JSON.stringify(this.currentEntry);
    const initial = JSON.stringify(this.initialEntryState);
    this.hasChanges = current !== initial;
    this.cdr.detectChanges();
  }

  cancelChanges() {
    if (this.initialEntryState) {
      this.currentEntry = JSON.parse(JSON.stringify(this.initialEntryState));
    } else {
      this.resetCurrentEntry(this.selectedDateString);
    }
    this.hasChanges = false;
    this.presentAlert('Annullato', 'Le modifiche sono state annullate.');
    this.cdr.detectChanges();
  }

  async saveEntry() {
    if (!this.userId) {
      await this.presentAlert('Errore', 'Utente non autenticato. Impossibile salvare.');
      return;
    }
    if (!this.hasChanges) {
      await this.presentAlert('Attenzione', 'Nessuna modifica da salvare.');
      return;
    }

    this.currentEntry.date = this.formatDate(this.selectedDate);

    const entryToSave: Partial<DailyEntry> = { ...this.currentEntry };

    for (const key in entryToSave) {
      if (entryToSave.hasOwnProperty(key)) {
        // @ts-ignore
        // Questa annotazione sopprime l'errore TypeScript perché sappiamo che stiamo gestendo valori undefined
        if (entryToSave[key] === undefined) {
          // @ts-ignore
          delete entryToSave[key];
        }
      }
    }

    this.diaryService.saveDailyEntry(this.userId, entryToSave as DailyEntry).subscribe({
      next: async () => {
        await this.presentAlert('Successo', 'Voce del diario salvata!');
        this.initialEntryState = JSON.parse(JSON.stringify(this.currentEntry));
        this.hasChanges = false;
        this.loadRecentEntries(); // Ricarica le voci recenti per aggiornare il grafico
        this.loadHighlightedDates();

        const wordCount = this.currentEntry.note ? this.currentEntry.note.split(/\s+/).filter(word => word.length > 0).length : 0;
        const currentTimestampISO = new Date().toISOString();

        await this.userDataService.incrementDiaryTotalWords(wordCount);
        await this.userDataService.setDiaryLastInteraction(currentTimestampISO);

        const userData = await this.userDataService.getUserData();
        const lastSavedInteractionDate = userData?.diaryLastInteraction ? new Date(userData.diaryLastInteraction).toDateString() : null;
        const currentEntryDate = new Date(this.currentEntry.date).toDateString();

        if (lastSavedInteractionDate !== currentEntryDate) {
          await this.userDataService.incrementDiaryEntryCount();
        } else {
        }
        const xpToAward = 25;
        this.expService.addExperience(xpToAward, 'Diario Compilato');
        this.cdr.detectChanges();
      },
      error: async (error: any) => {
        console.error('Errore nel salvataggio della voce del diario:', error);
        await this.presentAlert('Errore', 'Impossibile salvare la voce del diario.');
        this.cdr.detectChanges();
      }
    });
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header: header,
      message: message,
      buttons: ['OK'],
      backdropDismiss: false
    });
    await alert.present();
  }

  private destroyChart() {
    if (this.moodChart) {
      this.moodChart.destroy();
      this.moodChart = undefined;
    }
  }

  renderMoodChart() {
    this.destroyChart(); // Distruggi il grafico esistente prima di crearne uno nuovo

    if (!this.moodChartCanvas || this.recentEntries.length === 0) {
      return; // Non renderizzare se non c'è canvas o dati
    }

    const ctx = this.moodChartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Impossibile ottenere il contesto 2D per il canvas.');
      return;
    }

    // Mappa i mood a valori numerici per il grafico
    const moodMap: { [key: string]: number } = {
      'felice': 5,
      'motivato': 4,
      'sereno': 3,
      'neutro': 2,
      'stanco': 1,
      'triste': 0,
      'arrabbiato': -1,
      'ansioso': -2,
      '': NaN // Mood non selezionato
    };

    const labels = this.recentEntries.map(entry => {
      const date = new Date(entry.date);
      return `${date.getDate()}/${date.getMonth() + 1}`; // Formato GG/MM
    });
    const data = this.recentEntries.map(entry => moodMap[entry.mood || '']);

    this.moodChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Andamento Umore',
          data: data,
          borderColor: '#00bcd4', // Colore primario-accent-calm
          backgroundColor: 'rgba(0, 188, 212, 0.2)',
          tension: 0.3, // Curva la linea
          fill: true,
          pointBackgroundColor: '#00bcd4',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#00bcd4'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              stepSize: 1,
              callback: function(value: any) {
                // Mappa i valori numerici alle etichette dei mood
                const reverseMoodMap: { [key: number]: string } = {
                  5: 'Felice',
                  4: 'Motivato',
                  3: 'Sereno',
                  2: 'Neutro',
                  1: 'Stanco',
                  0: 'Triste',
                  '-1': 'Nervoso',
                  '-2': 'Ansioso',
                };
                return reverseMoodMap[value] || '';
              },
              color: '#FFF' // Colore del testo delle etichette sull'asse Y
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)' // Colore delle griglie sull'asse Y
            }
          },
          x: {
            ticks: {
              color: '#FFF' // Colore del testo delle etichette sull'asse X
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)' // Colore delle griglie sull'asse X
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw as number;
                const reverseMoodMap: { [key: number]: string } = {
                  5: 'Felice',
                  4: 'Motivato',
                  3: 'Sereno',
                  2: 'Neutro',
                  1: 'Stanco',
                  0: 'Triste',
                  '-1': 'Nervoso',
                  '-2': 'Ansioso',
                };
                return `Umore: ${reverseMoodMap[value] || 'N/D'}`;
              }
            }
          }
        }
      }
    });
  }
}
