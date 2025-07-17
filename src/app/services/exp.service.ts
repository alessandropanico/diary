import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

// Interfaccia per i dati XP e livello
export interface UserExpData {
  totalXP: number;
  userLevel: number;
  currentXP: number; // XP accumulati nel livello attuale
  xpForNextLevel: number; // XP necessari per il prossimo livello
  progressPercentage: number;
}

@Injectable({
  providedIn: 'root'
})
export class ExpService {

  // Questo BehaviorSubject simulerà il caricamento degli XP totali da Firebase.
  // In un'applicazione reale, verrebbe inizializzato dal UserDataService o da un servizio Firebase Auth.
  private _totalXP = new BehaviorSubject<number>(870); // Valore iniziale di esempio
  readonly totalXP$: Observable<number> = this._totalXP.asObservable();

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
    // Aggiungi altri livelli qui per estendere la progressione
  ];

  constructor() {}

  /**
   * Restituisce un Observable con tutti i dati relativi all'esperienza e al livello dell'utente.
   */
  getUserExpData(): Observable<UserExpData> {
    return this.totalXP$.pipe(
      map(totalXP => this.calculateLevelAndProgress(totalXP))
    );
  }

  /**
   * Aggiunge Punti Esperienza (XP) all'utente.
   * Chiamato quando l'utente compie un'azione che conferisce XP.
   * @param xpAmount La quantità di XP da aggiungere.
   */
 addExperience(xpAmount: number, reason: string = 'unknown'): void { // <--- Modifica qui!
    const currentTotalXP = this._totalXP.getValue();
    const newTotalXP = currentTotalXP + xpAmount;
    this._totalXP.next(newTotalXP);
  }

  /**
   * Imposta il totale di XP dell'utente.
   * Utilizzato principalmente al caricamento iniziale dei dati dell'utente da Firebase.
   * @param totalXP Il valore totale di XP da impostare.
   */
  setTotalXP(totalXP: number): void {
    this._totalXP.next(totalXP);
  }

  /**
   * Metodo privato per calcolare il livello, XP attuali nel livello, XP per il prossimo livello e percentuale di progresso.
   * @param totalXP I punti esperienza totali accumulati dall'utente.
   * @returns Un oggetto UserExpData con i dettagli del livello.
   */
  private calculateLevelAndProgress(totalXP: number): UserExpData {
    let userLevel = 1;
    let xpForCurrentLevel = 0; // XP richiesti per raggiungere il livello attuale
    let xpForNextLevelThreshold = 0; // XP totali richiesti per raggiungere il prossimo livello

    // Trova il livello attuale e le soglie XP
    for (let i = this.levelThresholds.length - 1; i >= 0; i--) {
      if (totalXP >= this.levelThresholds[i].xpRequired) {
        userLevel = this.levelThresholds[i].level;
        xpForCurrentLevel = this.levelThresholds[i].xpRequired;
        if (i + 1 < this.levelThresholds.length) {
          xpForNextLevelThreshold = this.levelThresholds[i + 1].xpRequired;
        } else {
          // Se siamo all'ultimo livello definito, non c'è un prossimo livello.
          // Impostiamo xpForNextLevelThreshold al totalXP attuale per mostrare 100% di progresso.
          xpForNextLevelThreshold = totalXP;
        }
        break;
      }
    }

    const currentXP = totalXP - xpForCurrentLevel; // XP guadagnati nel livello attuale
    let xpForNextLevel = 0; // XP rimanenti per il prossimo livello
    let progressPercentage = 0;

    if (xpForNextLevelThreshold > xpForCurrentLevel) {
      xpForNextLevel = xpForNextLevelThreshold - xpForCurrentLevel;
      progressPercentage = (currentXP / xpForNextLevel) * 100;
    } else {
      progressPercentage = 100;
    }

    if (progressPercentage > 100) progressPercentage = 100;

    return { userLevel, totalXP, currentXP, xpForNextLevel, progressPercentage };
  }
}
