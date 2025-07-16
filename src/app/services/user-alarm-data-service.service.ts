// src/app/services/user-alarm-data-service.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc } from '@angular/fire/firestore'; // <--- Modificato

@Injectable({
  providedIn: 'root'
})
export class UserAlarmDataService {

  // Modifica il costruttore per iniettare Firestore (nuova API)
  constructor(private firestore: Firestore) { } // <--- Modificato

  async updateAlarmData(userId: string, activeCount: number, totalCreated: number, alarmStreak?: number) {
    if (!userId) {
      console.warn('UserAlarmDataService: Tentativo di aggiornare dati sveglie senza userId.');
      return;
    }

    // Usa le funzioni della nuova API
    const userRef = doc(collection(this.firestore, 'users'), userId); // <--- Modificato
    const dataToUpdate: any = {
      activeAlarmsCount: activeCount,
      totalAlarmsCreated: totalCreated,
      lastAlarmInteraction: new Date()
    };

    if (alarmStreak !== undefined) {
      dataToUpdate.alarmStreak = alarmStreak;
    }

    try {
      await setDoc(userRef, dataToUpdate, { merge: true }); // <--- Modificato
      console.log(`Dati sveglie aggiornati per utente ${userId} su Firebase.`);
    } catch (error) {
      console.error('Errore aggiornamento dati sveglie su Firebase:', error);
    }
  }
}
