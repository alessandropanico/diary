import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';
import { DiaryService, DailyEntry } from 'src/app/services/diary.service';
import { ExpService } from 'src/app/services/exp.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';
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

  constructor(
    private diaryService: DiaryService,
    private expService: ExpService,
    private userDataService: UserDataService,
    private alertCtrl: AlertController
  ) { }

  ngOnInit() {
    this.authStateUnsubscribe = getAuth().onAuthStateChanged(user => {
      if (user) {
        this.userId = user.uid;
        this.initializeDate();
        this.loadRecentEntries();
      } else {
        this.userId = null;
        this.resetCurrentEntry();
        this.initialEntryState = null;
        this.hasChanges = false;
        this.recentEntries = [];
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
      sleepQuality: '',
      stressLevel: 0,
      focusHours: undefined
    };
    // Non resetta hasChanges qui, lo farà loadDailyEntry o cancelChanges
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
        // Clona deep l'oggetto per initialEntryState
        this.initialEntryState = JSON.parse(JSON.stringify(this.currentEntry));
        this.hasChanges = false; // Nessuna modifica all'inizio dopo il caricamento
      },
      error: (error) => {
        console.error('Errore nel caricamento della voce del diario:', error);
        this.presentAlert('Errore', 'Impossibile caricare la voce del diario.');
        this.resetCurrentEntry(date);
        this.initialEntryState = null; // Nessuno stato iniziale se c'è un errore
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
      this.currentEntry.mood = ''; // Deseleziona l'umore
    } else {
      this.currentEntry.mood = mood; // Seleziona il nuovo umore
    }
    this.markAsChanged();
  }

  markAsChanged() {
    // Se initialEntryState non è ancora stato caricato (ad esempio, alla prima apertura di un nuovo giorno)
    // considera che ci sono modifiche se la currentEntry non è completamente vuota.
    if (this.initialEntryState === null) {
        // Controlla se QUALSIASI campo ha un valore significativo (diverso dai valori di default iniziali)
        // Questo è per le nuove voci che non sono mai state salvate.
        const defaultEmptyEntry: DailyEntry = {
            date: this.currentEntry.date, // La data deve corrispondere per il confronto
            mood: '',
            note: '',
            energyLevel: 0,
            sleepQuality: '',
            stressLevel: 0,
            focusHours: undefined
        };
        this.hasChanges = JSON.stringify(this.currentEntry) !== JSON.stringify(defaultEmptyEntry);
        return;
    }

    // Per voci esistenti o nuove voci dopo la prima interazione, confronta con initialEntryState
    const current = JSON.stringify(this.currentEntry);
    const initial = JSON.stringify(this.initialEntryState);
    this.hasChanges = current !== initial;
  }


  cancelChanges() {
    if (this.initialEntryState) {
      // Ripristina lo stato iniziale clonando per evitare riferimenti
      this.currentEntry = JSON.parse(JSON.stringify(this.initialEntryState));
    } else {
      // Se non c'era uno stato iniziale (nuova voce non ancora salvata),
      // resetta a uno stato completamente vuoto per il giorno corrente.
      this.resetCurrentEntry(this.selectedDateString);
    }
    this.hasChanges = false; // Nessuna modifica dopo l'annullamento
    this.presentAlert('Annullato', 'Le modifiche sono state annullate.');
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

    this.diaryService.saveDailyEntry(this.userId, this.currentEntry).subscribe({
      next: async () => {
        console.log('Voce diario salvata con successo:', this.currentEntry);
        await this.presentAlert('Successo', 'Voce del diario salvata!');
        // Aggiorna initialEntryState DOPO il salvataggio riuscito
        this.initialEntryState = JSON.parse(JSON.stringify(this.currentEntry));
        this.hasChanges = false; // Nessuna modifica dopo il salvataggio
        this.loadRecentEntries();

        // INIZIO AGGIORNAMENTO CONTATORI DASHBOARD
        const wordCount = this.currentEntry.note ? this.currentEntry.note.split(/\s+/).filter(word => word.length > 0).length : 0;
        const currentTimestampISO = new Date().toISOString();

        await this.userDataService.incrementDiaryTotalWords(wordCount);
        console.log(`Aggiornato conteggio parole totali: ${wordCount} parole aggiunte.`);

        await this.userDataService.setDiaryLastInteraction(currentTimestampISO);
        console.log(`Ultima interazione diario impostata a: ${currentTimestampISO}.`);

        const userData = await this.userDataService.getUserData();
        // Utilizziamo solo la data per il confronto, ignorando l'ora
        const lastSavedInteractionDate = userData?.diaryLastInteraction ? new Date(userData.diaryLastInteraction).toDateString() : null;
        const currentEntryDate = new Date(this.currentEntry.date).toDateString();

        if (lastSavedInteractionDate !== currentEntryDate) {
          await this.userDataService.incrementDiaryEntryCount();
          console.log("Contatore delle voci del diario incrementato (nuova voce per un giorno distinto).");
        } else {
          console.log("Voce del diario aggiornata per lo stesso giorno. Non incremento il contatore delle voci distinte.");
        }
        // FINE AGGIORNAMENTO CONTATORI DASHBOARD

        const xpToAward = 25;
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
