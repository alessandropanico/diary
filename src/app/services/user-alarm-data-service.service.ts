// src/app/services/user-alarm-data.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore'; // Assicurati di avere @angular/fire installato

@Injectable({
  providedIn: 'root'
})
export class UserAlarmDataService {

  constructor(private afs: AngularFirestore) { }

  /**
   * Aggiorna le metriche (dati) relative alle sveglie per un utente specifico su Firebase.
   * @param userId L'ID univoco dell'utente.
   * @param activeCount Il numero di sveglie attive.
   * @param totalCreated Il numero totale di sveglie create.
   * @param alarmStreak (Opzionale) La streak di giorni consecutivi con sveglie attive.
   */
  async updateAlarmData(userId: string, activeCount: number, totalCreated: number, alarmStreak?: number) {
    if (!userId) {
      console.warn('UserAlarmDataService: Tentativo di aggiornare dati sveglie senza userId.');
      return;
    }

    const userRef = this.afs.collection('users').doc(userId);
    const dataToUpdate: any = {
      activeAlarmsCount: activeCount,
      totalAlarmsCreated: totalCreated,
      lastAlarmInteraction: new Date() // Timestamp dell'ultima interazione
    };

    if (alarmStreak !== undefined) {
      dataToUpdate.alarmStreak = alarmStreak;
    }

    try {
      await userRef.set(dataToUpdate, { merge: true });
      console.log(`Dati sveglie aggiornati per utente ${userId} su Firebase.`);
    } catch (error) {
      console.error('Errore aggiornamento dati sveglie su Firebase:', error);
    }
  }

  // Puoi aggiungere qui altri metodi per leggere questi dati, se servisse in futuro
  // getUserAlarmData(userId: string): Observable<any> {
  //   return this.afs.collection('users').doc(userId).valueChanges();
  // }
}
