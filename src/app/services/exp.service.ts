import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface UserExpData {
  totalXP: number;
  userLevel: number;
  currentXP: number;
  xpForNextLevel: number;
  progressPercentage: number;
  maxLevelReached: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExpService {

  private _totalXP = new BehaviorSubject<number>(870);
  readonly totalXP$: Observable<number> = this._totalXP.asObservable();

  private readonly MAX_LEVEL = 100000;
  private readonly BASE_XP_PER_LEVEL = 50;
  private readonly XP_GROWTH_FACTOR = 1.2;
  private readonly EXPONENT_FACTOR = 1.5;

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
  ];

  constructor() {}


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
  }

  /**
   * Utilizzato principalmente al caricamento iniziale dei dati dell'utente da Firebase (quando lo implementeremo).
   * @param totalXP Il valore totale di XP da impostare.
   */
  setTotalXP(totalXP: number): void {
    this._totalXP.next(totalXP);
  }

  private calculateXpForLevel(level: number): number {
    if (level < 1) return 0;

    for (const threshold of this.initialLevelThresholds) {
      if (level === threshold.level) {
        return threshold.xpRequired;
      }
    }

    const lastInitialLevel = this.initialLevelThresholds[this.initialLevelThresholds.length - 1].level;
    const xpAtLastInitialLevel = this.initialLevelThresholds[this.initialLevelThresholds.length - 1].xpRequired;
    const effectiveLevel = level - lastInitialLevel;

    if (effectiveLevel <= 0) {
        return xpAtLastInitialLevel;
    }

    const calculatedXP = xpAtLastInitialLevel +
                         Math.floor(this.BASE_XP_PER_LEVEL * Math.pow(effectiveLevel, this.EXPONENT_FACTOR) * this.XP_GROWTH_FACTOR);

    return calculatedXP;
  }

  /**
   * Metodo privato per calcolare il livello, XP attuali nel livello, XP per il prossimo livello e percentuale di progresso.
   * @param totalXP I punti esperienza totali accumulati dall'utente.
   * @returns Un oggetto UserExpData con i dettagli del livello.
   */
  private calculateLevelAndProgress(totalXP: number): UserExpData {
    let userLevel = 1;
    let xpForCurrentLevel = 0;
    let xpForNextLevelThreshold = 0;
    let maxLevelReached = false;

    for (let i = 1; i <= this.MAX_LEVEL; i++) {
      const requiredXPForThisLevel = this.calculateXpForLevel(i);

      if (totalXP >= requiredXPForThisLevel) {
        userLevel = i;
        xpForCurrentLevel = requiredXPForThisLevel;
      } else {
        xpForNextLevelThreshold = requiredXPForThisLevel;
        break;
      }

      if (i === this.MAX_LEVEL && totalXP >= requiredXPForThisLevel) {
        userLevel = this.MAX_LEVEL;
        xpForCurrentLevel = requiredXPForThisLevel;
        xpForNextLevelThreshold = requiredXPForThisLevel;
        maxLevelReached = true;
        break;
      }
    }

    const currentXP = totalXP - xpForCurrentLevel;

    let xpForNextLevel = 0;
    let progressPercentage = 0;

    if (maxLevelReached) {
      xpForNextLevel = 0;
      progressPercentage = 100;
    } else {
      const xpNeededForThisLevelSpan = xpForNextLevelThreshold - xpForCurrentLevel;

      if (xpNeededForThisLevelSpan > 0) {
        xpForNextLevel = xpForNextLevelThreshold - totalXP;
        progressPercentage = (currentXP / xpNeededForThisLevelSpan) * 100;
      } else {
        xpForNextLevel = 0;
        progressPercentage = 100;
      }
    }

    if (progressPercentage > 100) progressPercentage = 100;
    if (xpForNextLevel < 0) xpForNextLevel = 0;

    return { userLevel, totalXP, currentXP, xpForNextLevel, progressPercentage, maxLevelReached };
  }
}
