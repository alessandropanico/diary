import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Interfaccia per i dati XP e livello
export interface UserExpData {
  totalXP: number;
  userLevel: number;
  currentXP: number; // XP accumulati nel livello attuale
  xpForNextLevel: number; // XP necessari per il prossimo livello
  progressPercentage: number;
  maxLevelReached: boolean; // ⭐ NUOVO: Indica se l'utente ha raggiunto il livello massimo
}

@Injectable({
  providedIn: 'root'
})
export class ExpService {

  // Questo BehaviorSubject simulerà il caricamento degli XP totali.
  // Manteniamo il valore iniziale di esempio di 870 come nel tuo codice.
  private _totalXP = new BehaviorSubject<number>(870);
  readonly totalXP$: Observable<number> = this._totalXP.asObservable();

  // ⭐ NUOVE COSTANTI E SOGLIE INIZIALI PER LA PROGRESSIONE DINAMICA ⭐
  private readonly MAX_LEVEL = 100000; // Il livello massimo desiderato
  private readonly BASE_XP_PER_LEVEL = 50; // XP base per la formula, puoi aggiustarlo
  private readonly XP_GROWTH_FACTOR = 1.2; // Fattore di crescita, puoi aggiustarlo
  private readonly EXPONENT_FACTOR = 1.5; // Esponente per una crescita non lineare, puoi aggiustarlo

  // Soglie XP fisse per i primi livelli (per un inizio più morbido)
  // Questo sostituisce la tua `private levelThresholds` esistente.
  private readonly initialLevelThresholds: { level: number, xpRequired: number }[] = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 100 },
    { level: 3, xpRequired: 350 },
    { level: 4, xpRequired: 850 },
    { level: 5, xpRequired: 1650 },
    { level: 6, xpRequired: 2850 },
    { level: 7, xpRequired: 4550 },
    { level: 8, xpRequired: 6850 },
    { level: 9, xpRequired: 9850 },
    { level: 10, xpRequired: 13850 },
    // Aggiungi altri livelli fissi qui se lo desideri, prima che parta la formula
  ];
  // ⭐ FINE NUOVE COSTANTI E SOGLIE INIZIALI ⭐

  constructor() {
    // Il costruttore rimane vuoto come nel tuo originale, senza dipendenze esterne.
  }

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
   * @param reason Una stringa per descrivere la ragione (es. 'Diario Salvato').
   */
  addExperience(xpAmount: number, reason: string = 'unknown'): void {
    const currentTotalXP = this._totalXP.getValue();
    const newTotalXP = currentTotalXP + xpAmount;
    this._totalXP.next(newTotalXP);
    console.log(`ExpService: Aggiunti ${xpAmount} XP per '${reason}'. Nuovo totale: ${newTotalXP}`);
    // ⭐ Nota: Gli XP rimangono solo nel _totalXP del servizio in memoria, come specificato nel tuo commento.
    // La persistenza dovrebbe essere gestita esternamente (es. da UserDataService).
  }

  /**
   * Imposta il totale di XP dell'utente.
   * Utilizzato principalmente al caricamento iniziale dei dati dell'utente da Firebase (quando lo implementeremo).
   * @param totalXP Il valore totale di XP da impostare.
   */
  setTotalXP(totalXP: number): void {
    this._totalXP.next(totalXP);
    console.log(`ExpService: Total XP impostato a: ${totalXP}`);
  }

  // ⭐ NUOVA FUNZIONE PER CALCOLARE GLI XP PER UN DATO LIVELLO ⭐
  private calculateXpForLevel(level: number): number {
    if (level < 1) return 0;

    // Gestisce i primi livelli con valori fissi definiti in initialLevelThresholds
    for (const threshold of this.initialLevelThresholds) {
      if (level === threshold.level) {
        return threshold.xpRequired;
      }
    }

    // Per i livelli oltre quelli iniziali (dopo il decimo nel tuo esempio), usa una formula
    // Calcola il "livello effettivo" per la formula sottraendo il numero di livelli fissi
    const lastInitialLevel = this.initialLevelThresholds[this.initialLevelThresholds.length - 1].level;
    const xpAtLastInitialLevel = this.initialLevelThresholds[this.initialLevelThresholds.length - 1].xpRequired;
    const effectiveLevel = level - lastInitialLevel;

    if (effectiveLevel <= 0) { // Questo non dovrebbe accadere se la logica di chiamata è corretta
        return xpAtLastInitialLevel; // Se per qualche motivo si chiede un livello già coperto dai fissi.
    }

    // Formula di progressione per i livelli più alti
    // Questa formula rende la crescita più lenta in termini di XP necessari per livello
    // man mano che il livello aumenta (grazie all'esponente > 1).
    const calculatedXP = xpAtLastInitialLevel +
                         Math.floor(this.BASE_XP_PER_LEVEL * Math.pow(effectiveLevel, this.EXPONENT_FACTOR) * this.XP_GROWTH_FACTOR);

    return calculatedXP;
  }
  // ⭐ FINE NUOVA FUNZIONE ⭐

  /**
   * Metodo privato per calcolare il livello, XP attuali nel livello, XP per il prossimo livello e percentuale di progresso.
   * @param totalXP I punti esperienza totali accumulati dall'utente.
   * @returns Un oggetto UserExpData con i dettagli del livello.
   */
  private calculateLevelAndProgress(totalXP: number): UserExpData {
    let userLevel = 1;
    let xpForCurrentLevel = 0; // XP totali richiesti per raggiungere il livello attuale
    let xpForNextLevelThreshold = 0; // XP totali richiesti per raggiungere il prossimo livello
    let maxLevelReached = false; // ⭐ NUOVA PROPRIETÀ

    // Trova il livello attuale e le soglie XP iterando da 1 fino al MAX_LEVEL
    for (let i = 1; i <= this.MAX_LEVEL; i++) {
      const requiredXPForThisLevel = this.calculateXpForLevel(i);

      if (totalXP >= requiredXPForThisLevel) {
        userLevel = i;
        xpForCurrentLevel = requiredXPForThisLevel;
      } else {
        // Trovato il primo livello 'i' per cui gli XP totali dell'utente non sono sufficienti.
        // Questo 'i' è il prossimo livello che l'utente deve raggiungere.
        xpForNextLevelThreshold = requiredXPForThisLevel;
        break; // Esci dal ciclo
      }

      // Se l'utente ha raggiunto o superato gli XP del MAX_LEVEL
      if (i === this.MAX_LEVEL && totalXP >= requiredXPForThisLevel) {
        userLevel = this.MAX_LEVEL;
        xpForCurrentLevel = requiredXPForThisLevel;
        xpForNextLevelThreshold = requiredXPForThisLevel; // Non c'è un "prossimo" livello oltre il MAX
        maxLevelReached = true;
        break; // Esci dal ciclo
      }
    }

    const currentXP = totalXP - xpForCurrentLevel; // XP guadagnati nel livello attuale

    let xpForNextLevel = 0;
    let progressPercentage = 0;

    if (maxLevelReached) {
      xpForNextLevel = 0; // Nessun XP per il prossimo livello se sei al massimo
      progressPercentage = 100; // Progresso al 100%
    } else {
      // Calcola gli XP necessari per passare dal livello attuale (xpForCurrentLevel) al prossimo (xpForNextLevelThreshold)
      const xpNeededForThisLevelSpan = xpForNextLevelThreshold - xpForCurrentLevel;

      if (xpNeededForThisLevelSpan > 0) {
        xpForNextLevel = xpForNextLevelThreshold - totalXP;
        progressPercentage = (currentXP / xpNeededForThisLevelSpan) * 100;
      } else {
        // Questo caso si verifica se xpNeededForThisLevelSpan è 0 (es. al livello 1 con 0 XP richiesti)
        xpForNextLevel = 0;
        progressPercentage = 100;
      }
    }

    // Assicurati che i valori non superino i limiti logici
    if (progressPercentage > 100) progressPercentage = 100;
    if (xpForNextLevel < 0) xpForNextLevel = 0;

    return { userLevel, totalXP, currentXP, xpForNextLevel, progressPercentage, maxLevelReached };
  }
}
