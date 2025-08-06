// src/app/services/exp.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
// ⭐ Importa updateDoc e Auth per ottenere l'utente corrente
import { doc, getDoc, updateDoc, Firestore } from '@angular/fire/firestore';
import { Auth, user } from '@angular/fire/auth'; // ⭐ Aggiungi 'user' per l'Observable
import { take } from 'rxjs/operators'; // ⭐ Aggiungi 'take'

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

  constructor(private firestore: Firestore, private auth: Auth) {} // ⭐ INIETTA AUTH ⭐

  getUserExpData(): Observable<UserExpData> {
    return this.totalXP$.pipe(
      map(totalXP => this.calculateLevelAndProgress(totalXP))
    );
  }

  getUserExpDataByUid(uid: string): Observable<UserExpData> {
    if (!uid) {
      console.warn('getUserExpDataByUid: UID non fornito.');
      return new BehaviorSubject<UserExpData>({
        totalXP: 0, userLevel: 1, currentXP: 0, xpForNextLevel: 100, progressPercentage: 0, maxLevelReached: false
      }).asObservable();
    }

    const userDocRef = doc(this.firestore, `users/${uid}`);
    return from(getDoc(userDocRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const totalXP = userData['totalXP'] as number || 0;
          return this.calculateLevelAndProgress(totalXP);
        } else {
          return {
            totalXP: 0, userLevel: 1, currentXP: 0, xpForNextLevel: 100, progressPercentage: 0, maxLevelReached: false
          };
        }
      }),
      catchError(error => {
        console.error(`Errore nel recupero dati EXP per UID ${uid}:`, error);
        return new BehaviorSubject<UserExpData>({
          totalXP: 0, userLevel: 1, currentXP: 0, xpForNextLevel: 100, progressPercentage: 0, maxLevelReached: false
        }).asObservable();
      })
    );
  }

  /**
   * ⭐ METODO AGGIORNATO: Aggiunge XP all'utente loggato e aggiorna Firestore. ⭐
   * @param xpAmount La quantità di XP da aggiungere.
   * @param reason Una stringa per descrivere la ragione.
   */
  async addExperience(xpAmount: number, reason: string = 'unknown'): Promise<void> {
    const currentUser = this.auth.currentUser;

    if (currentUser) {
      const userDocRef = doc(this.firestore, `users/${currentUser.uid}`);
      try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const currentTotalXP = userData['totalXP'] as number || 0;
          const newTotalXP = currentTotalXP + xpAmount;

          // Aggiorna il documento su Firestore
          await updateDoc(userDocRef, { totalXP: newTotalXP });

          // Aggiorna il BehaviorSubject locale per mantenere la UI sincronizzata
          this._totalXP.next(newTotalXP);

        }
      } catch (error) {
        console.error("Errore nell'aggiornare gli XP su Firestore:", error);
      }
    } else {
      console.warn("Nessun utente loggato. Impossibile aggiungere XP.");
    }
  }

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

  public calculateLevelAndProgress(totalXP: number): UserExpData {
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

  getLevelFromXP(totalXP: number): number {
    return this.calculateLevelAndProgress(totalXP).userLevel;
  }
}
