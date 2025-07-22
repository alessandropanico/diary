import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';
import { DiaryService, DailyEntry } from 'src/app/services/diary.service';
import { ExpService } from 'src/app/services/exp.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';
import { getAuth } from 'firebase/auth';

// --- INTERFACCIA PER LE DATE EVIDENZIATE ---
interface HighlightedDate {
  date: string; // Formato 'YYYY-MM-DD'
  textColor?: string;
  backgroundColor?: string;
}
// --- FINE INTERFACCIA ---

@Component({
  selector: 'app-diario',
  templateUrl: './diario.page.html',
  styleUrls: ['./diario.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiarioPage implements OnInit, OnDestroy {

  selectedDate: Date = new Date();
  selectedDateString: string = '';
  todayString: string = this.formatDate(new Date());

  currentEntry: DailyEntry = {
    date: '',
    mood: '',
    note: '',
    energyLevel: 0,
    sleepQuality: '', // Assicurati che il valore iniziale rispetti il tipo
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
  }

  private resetCurrentEntry(date: string = this.formatDate(new Date())) {
    this.currentEntry = {
      date: date,
      mood: '',
      note: '',
      energyLevel: 0,
      sleepQuality: '', // Deve essere '' o uno dei valori letterali
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
        // Valori validi per sleepQuality
        const validSleepQualities = ['scarso', 'medio', 'ottimo'];
        // Assicurati che sleepQuality sia uno dei valori attesi o una stringa vuota
        const loadedSleepQuality = entry?.sleepQuality && validSleepQualities.includes(entry.sleepQuality)
          ? entry.sleepQuality as 'scarso' | 'medio' | 'ottimo' // Cast esplicito
          : ''; // Default a stringa vuota se non valido o assente

        this.currentEntry = {
          date: date,
          mood: entry?.mood ?? '',
          note: entry?.note ?? '',
          energyLevel: entry?.energyLevel ?? 0,
          sleepQuality: loadedSleepQuality, // Assegna il valore validato
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
      return;
    }
    this.diaryService.getRecentDailyEntries(this.userId, 7).subscribe({
      next: (entries) => {
        this.recentEntries = entries;
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

  // NUOVO METODO PER LA QUALITÀ DEL SONNO - Tipizzazione raffinata per prevenire errori
  selectSleepQuality(quality: 'scarso' | 'medio' | 'ottimo') {
    if (this.currentEntry.sleepQuality === quality) {
      this.currentEntry.sleepQuality = ''; // Deseleziona
    } else {
      this.currentEntry.sleepQuality = quality; // Seleziona
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
        console.log('Voce diario salvata con successo:', this.currentEntry);
        await this.presentAlert('Successo', 'Voce del diario salvata!');
        this.initialEntryState = JSON.parse(JSON.stringify(this.currentEntry));
        this.hasChanges = false;
        this.loadRecentEntries();
        this.loadHighlightedDates();

        const wordCount = this.currentEntry.note ? this.currentEntry.note.split(/\s+/).filter(word => word.length > 0).length : 0;
        const currentTimestampISO = new Date().toISOString();

        await this.userDataService.incrementDiaryTotalWords(wordCount);
        console.log(`Aggiornato conteggio parole totali: ${wordCount} parole aggiunte.`);

        await this.userDataService.setDiaryLastInteraction(currentTimestampISO);
        console.log(`Ultima interazione diario impostata a: ${currentTimestampISO}.`);

        const userData = await this.userDataService.getUserData();
        const lastSavedInteractionDate = userData?.diaryLastInteraction ? new Date(userData.diaryLastInteraction).toDateString() : null;
        const currentEntryDate = new Date(this.currentEntry.date).toDateString();

        if (lastSavedInteractionDate !== currentEntryDate) {
          await this.userDataService.incrementDiaryEntryCount();
          console.log("Contatore delle voci del diario incrementato (nuova voce per un giorno distinto).");
        } else {
          console.log("Voce del diario aggiornata per lo stesso giorno. Non incremento il contatore delle voci distinte.");
        }

        const xpToAward = 25;
        this.expService.addExperience(xpToAward, 'Diario Compilato');
        console.log(`Guadagnati ${xpToAward} XP per aver salvato il diario.`);
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
}
