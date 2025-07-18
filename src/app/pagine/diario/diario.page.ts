// src/app/diario/diario.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';
import { UserDataService } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';
import { getAuth, User } from 'firebase/auth';

// Interfaccia per la voce del diario
interface DailyEntry {
  date: string; // Formato YYYY-MM-DD
  mood: string;
  note: string;
  timestamp?: number; // Per Firebase Server Timestamp (opzionale)
}

@Component({
  selector: 'app-diario',
  templateUrl: './diario.page.html',
  styleUrls: ['./diario.page.scss'],
  standalone: false,
})
export class DiarioPage implements OnInit, OnDestroy {

  // Proprietà per la data selezionata
  selectedDate: Date = new Date();
  selectedDateString: string = ''; // Usato con ion-datetime
  todayString: string = new Date().toISOString(); // Per limitare il datetime picker al giorno corrente

  // Proprietà per la voce del diario del giorno selezionato
  currentEntry: DailyEntry = {
    date: '',
    mood: '',
    note: ''
  };

  // Proprietà per tracciare i cambiamenti e abilitare/disabilitare il pulsante Salva
  initialEntryState: DailyEntry | null = null;
  hasChanges: boolean = false;

  private authStateUnsubscribe: (() => void) | undefined;
  private userId: string | null = null;
  private currentEntrySubscription: Subscription | undefined;

  constructor(
    private userDataService: UserDataService,
    private alertCtrl: AlertController
  ) { }

  ngOnInit() {
    this.authStateUnsubscribe = getAuth().onAuthStateChanged(user => {
      if (user) {
        this.userId = user.uid;
        this.initializeDate();
      } else {
        this.userId = null;
        // Resetta lo stato se l'utente non è loggato
        this.currentEntry = { date: '', mood: '', note: '' };
        this.initialEntryState = null;
        this.hasChanges = false;
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

  // ⭐ Inizializza la data al giorno corrente e carica la voce
  initializeDate() {
    this.selectedDate = new Date();
    this.selectedDateString = this.selectedDate.toISOString();
    this.loadDailyEntry(this.formatDate(this.selectedDate));
  }

  // ⭐ Gestisce il cambio data dal picker
  onDateChange() {
    this.selectedDate = new Date(this.selectedDateString);
    this.loadDailyEntry(this.formatDate(this.selectedDate));
  }

  // ⭐ Passa al giorno precedente
  previousDay() {
    this.selectedDate.setDate(this.selectedDate.getDate() - 1);
    this.selectedDateString = this.selectedDate.toISOString();
    this.loadDailyEntry(this.formatDate(this.selectedDate));
  }

  // ⭐ Passa al giorno successivo (senza limiti nel futuro)
  nextDay() {
    this.selectedDate.setDate(this.selectedDate.getDate() + 1);
    this.selectedDateString = this.selectedDate.toISOString();
    this.loadDailyEntry(this.formatDate(this.selectedDate));
  }

  // ⭐ Formatta la data in YYYY-MM-DD
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ⭐ Carica la voce del diario per la data selezionata
  async loadDailyEntry(date: string) {
    if (!this.userId) {
      console.warn('Utente non autenticato. Impossibile caricare la voce del diario.');
      // Resetta la voce corrente a vuota se non autenticato
      this.currentEntry = { date: date, mood: '', note: '' };
      this.initialEntryState = null;
      this.hasChanges = false;
      return;
    }

    try {
      // ⭐ QUI DOVRAI CHIAMARE IL TUO UserDataService per recuperare i dati reali
      // Esempio (decommenta e implementa quando pronto):
      // const entry = await this.userDataService.getDailyEntry(this.userId, date);

      // Per ora, simuliamo il recupero dei dati:
      const simulatedEntry: DailyEntry = { date: date, mood: '', note: '' }; // Default vuoto
      // Puoi aggiungere qui una logica per dati di test se vuoi vedere qualcosa
      // if (date === '2025-07-17') { // Esempio di dato di test per ieri
      //   simulatedEntry.mood = 'felice';
      //   simulatedEntry.note = 'Oggi è stata una giornata fantastica, ho finito il progetto!';
      // }
      const entry = simulatedEntry; // Sostituisci con il risultato del servizio

      this.currentEntry = { ...entry };
      this.initialEntryState = { ...entry }; // Salva lo stato iniziale per il confronto
      this.hasChanges = false; // Nessun cambiamento all'inizio
    } catch (error) {
      console.error('Errore nel caricamento della voce del diario:', error);
      this.presentAlert('Errore', 'Impossibile caricare la voce del diario.');
      this.currentEntry = { date: date, mood: '', note: '' }; // Resetta in caso di errore
      this.initialEntryState = null;
      this.hasChanges = false;
    }
  }

  // ⭐ Seleziona/deseleziona l'umore
  selectMood(mood: string) {
    if (this.currentEntry.mood === mood) {
      // Deseleziona se già selezionato
      this.currentEntry.mood = '';
    } else {
      this.currentEntry.mood = mood;
    }
    this.markAsChanged();
  }

  // ⭐ Controlla se ci sono modifiche per abilitare il pulsante "Salva"
  markAsChanged() {
    this.hasChanges =
      this.currentEntry.mood !== (this.initialEntryState?.mood ?? '') ||
      this.currentEntry.note !== (this.initialEntryState?.note ?? '');
  }

  // ⭐ Salva la voce del diario
  async saveEntry() {
    if (!this.userId) {
      await this.presentAlert('Errore', 'Utente non autenticato. Impossibile salvare.');
      return;
    }
    if (!this.hasChanges) {
      await this.presentAlert('Attenzione', 'Nessuna modifica da salvare.');
      return;
    }

    this.currentEntry.date = this.formatDate(this.selectedDate); // Assicura che la data sia corretta
    this.currentEntry.timestamp = Date.now(); // Aggiungi un timestamp di salvataggio (o usa Firebase Server Timestamp)

    try {
      // ⭐ QUI DOVRAI CHIAMARE IL TUO UserDataService per salvare i dati reali
      // Esempio (decommenta e implementa quando pronto):
      // await this.userDataService.saveDailyEntry(this.userId, this.currentEntry);

      console.log('Voce diario salvata (simulato):', this.currentEntry);
      await this.presentAlert('Successo', 'Voce del diario salvata!');
      this.initialEntryState = { ...this.currentEntry }; // Aggiorna lo stato iniziale
      this.hasChanges = false;
    } catch (error) {
      console.error('Errore nel salvataggio della voce del diario:', error);
      await this.presentAlert('Errore', 'Impossibile salvare la voce del diario.');
    }
  }

  // ⭐ Helper per mostrare alert
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
