import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';
import { DiaryService, DailyEntry } from 'src/app/services/diary.service';
import { ExpService } from 'src/app/services/exp.service'; // ⭐ Rimosso UserExpData dall'import
import { Subscription } from 'rxjs'; // Rimosso Observable dall'import
import { getAuth } from 'firebase/auth';

@Component({
  selector: 'app-diario',
  templateUrl: './diario.page.html',
  styleUrls: ['./diario.page.scss'],
  standalone: false,
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

  // ⭐ Rimosso: userExpData$: Observable<UserExpData>;

  constructor(
    private diaryService: DiaryService,
    private expService: ExpService, // ExpService rimane iniettato
    private alertCtrl: AlertController
  ) {
    // ⭐ Rimosso: this.userExpData$ = this.expService.getUserExpData();
  }

  ngOnInit() {
    this.authStateUnsubscribe = getAuth().onAuthStateChanged(user => {
      if (user) {
        this.userId = user.uid;
        this.initializeDate();
        this.loadRecentEntries();
        // La logica di setTotalXP qui può rimanere, utile per inizializzare ExpService con 0 XP se l'utente non è autenticato.
        // Se in futuro collegherai il UserDataService per la persistenza, questa sarà la riga dove caricherai gli XP dal DB.
      } else {
        this.userId = null;
        this.resetCurrentEntry();
        this.initialEntryState = null;
        this.hasChanges = false;
        this.recentEntries = [];
        this.expService.setTotalXP(0); // Resetta XP a 0 al logout
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
        this.currentEntry = {
          date: date,
          mood: entry?.mood ?? '',
          note: entry?.note ?? '',
          energyLevel: entry?.energyLevel ?? 0,
          sleepQuality: entry?.sleepQuality ?? '',
          stressLevel: entry?.stressLevel ?? 0,
          focusHours: entry?.focusHours ?? undefined
        };
        this.initialEntryState = { ...this.currentEntry };
        this.hasChanges = false;
      },
      error: (error) => {
        console.error('Errore nel caricamento della voce del diario:', error);
        this.presentAlert('Errore', 'Impossibile caricare la voce del diario.');
        this.resetCurrentEntry(date);
        this.initialEntryState = null;
        this.hasChanges = false;
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
      },
      error: (error) => {
        console.error('Errore nel caricamento delle voci recenti:', error);
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
  }

  markAsChanged() {
    const current = JSON.stringify(this.currentEntry);
    const initial = JSON.stringify(this.initialEntryState);
    this.hasChanges = current !== initial;
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

    // Salvataggio della voce del diario
    this.diaryService.saveDailyEntry(this.userId, this.currentEntry).subscribe({
      next: async () => {
        console.log('Voce diario salvata con successo:', this.currentEntry);
        await this.presentAlert('Successo', 'Voce del diario salvata!');
        this.initialEntryState = { ...this.currentEntry };
        this.hasChanges = false;
        this.loadRecentEntries();

        // ⭐ Aggiunta degli XP dopo il salvataggio del diario
        // Decidi quanti XP dare. Iniziamo con un valore modesto.
        const xpToAward = 25; // Esempio: 25 XP per aver compilato una voce del diario
        this.expService.addExperience(xpToAward, 'Diario Compilato');
        console.log(`Guadagnati ${xpToAward} XP per aver salvato il diario.`);

      },
      error: async (error) => {
        console.error('Errore nel salvataggio della voce del diario:', error);
        await this.presentAlert('Errore', 'Impossibile salvare la voce del diario.');
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
