// src/app/services/user-alarm-data.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, getDoc } from '@angular/fire/firestore';
import { ExpService } from './exp.service';
import { UserDataService } from './user-data.service'; // Importa UserDataService

@Injectable({
  providedIn: 'root'
})
export class UserAlarmDataService {

  constructor(
    private firestore: Firestore,
    private expService: ExpService,
    private userDataService: UserDataService // Inietta UserDataService
  ) { }

  /**
   * Aggiorna i dati delle sveglie per un utente, inclusi i conteggi e l'attività globale.
   * Questo è il metodo principale per tutte le modifiche alle metriche delle sveglie.
   * @param userId L'ID dell'utente.
   * @param activeCount Il numero di sveglie attive (da impostare).
   * @param totalCreated Il numero totale di sveglie create (da impostare).
   * @param alarmStreak (Opzionale) La streak delle sveglie.
   * @param completedAlarm (Opzionale) Se la chiamata è dovuta al completamento di una sveglia, per aggiungere XP.
   * @param createdNewAlarm (Opzionale) Se la chiamata è dovuta alla creazione di una nuova sveglia.
   */
  async updateAlarmData(
    userId: string,
    activeCount: number,
    totalCreated: number,
    alarmStreak?: number,
    completedAlarm: boolean = false,
    createdNewAlarm: boolean = false
  ) {
    if (!userId) {
      console.warn('UserAlarmDataService: Tentativo di aggiornare dati sveglie senza userId.');
      return;
    }

    const userRef = doc(collection(this.firestore, 'users'), userId);
    const now = new Date().toISOString(); // Usa ISO string per i timestamp

    const dataToUpdate: any = {
      activeAlarmsCount: activeCount,
      totalAlarmsCount: totalCreated,
      lastAlarmInteraction: now,
      // ✨ Questo è il punto chiave! Aggiorna il timestamp globale ad ogni interazione
      lastGlobalActivityTimestamp: now
    };

    if (alarmStreak !== undefined) {
      dataToUpdate.alarmStreak = alarmStreak;
    }

    try {
      // 1. Aggiorna i dati su Firebase Firestore
      await setDoc(userRef, dataToUpdate, { merge: true });

      // 2. Aggiungi gli XP SOLO se la sveglia è stata completata
      if (completedAlarm) {
        this.expService.addExperience(20); // Assumi che addExperience non abbia bisogno di userId qui
      }

      // 3. Notifica UserDataService per aggiornare lo stato locale e la dashboard
      // Questo invierà solo i campi che sono stati aggiornati qui.
      await this.userDataService.saveUserData({
        activeAlarmsCount: activeCount,
        totalAlarmsCount: totalCreated,
        lastGlobalActivityTimestamp: now // Passa il timestamp globale aggiornato
      });

    } catch (error) {
      console.error('Errore aggiornamento dati sveglie su Firebase:', error);
      throw error;
    }
  }

  /**
   * Questo metodo dovrebbe essere chiamato dal componente/logica che gestisce lo spegnimento della sveglia.
   * Aggiorna i contatori e assegna XP per il completamento.
   * Decrementa il conteggio delle sveglie attive.
   * @param userId L'ID dell'utente.
   */
  async onAlarmSuccessfullyDismissed(userId: string) {
    if (!userId) {
      console.warn('onAlarmSuccessfullyDismissed: Tentativo senza userId.');
      return;
    }

    const userDocRef = doc(collection(this.firestore, 'users'), userId);
    const userDocSnap = await getDoc(userDocRef);
    let currentActiveAlarms = 0;
    let currentTotalAlarms = 0;
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      currentActiveAlarms = userData['activeAlarmsCount'] || 0;
      currentTotalAlarms = userData['totalAlarmsCount'] || 0;
    }

    // Qui si assume che la sveglia che è stata "dismissed" non sia più attiva.
    // Quindi, decrementiamo activeAlarmsCount per riflettere questo stato.
    const newActiveAlarms = Math.max(0, currentActiveAlarms - 1);

    // Chiama il metodo principale per aggiornare i dati e l'attività globale
    await this.updateAlarmData(
      userId,
      newActiveAlarms,
      currentTotalAlarms,
      undefined,
      true, // TRUE: assegna XP per il completamento
      false
    );
  }

  /**
   * Questo metodo dovrebbe essere chiamato dal componente/logica che gestisce la creazione di una sveglia.
   * Aggiorna i contatori ma NON assegna XP.
   * Incrementa sia il conteggio delle sveglie attive che delle totali.
   * @param userId L'ID dell'utente.
   */
  async onAlarmCreated(userId: string) {
    if (!userId) {
      console.warn('onAlarmCreated: Tentativo senza userId.');
      return;
    }

    const userDocRef = doc(collection(this.firestore, 'users'), userId);
    const userDocSnap = await getDoc(userDocRef);
    let currentActiveAlarms = 0;
    let currentTotalAlarms = 0;
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      currentActiveAlarms = userData['activeAlarmsCount'] || 0;
      currentTotalAlarms = userData['totalAlarmsCount'] || 0;
    }

    // Assumiamo che una sveglia appena creata sia attiva per default.
    // Incrementiamo sia il conteggio delle attive che delle totali.
    // Chiama il metodo principale per aggiornare i dati e l'attività globale
    await this.updateAlarmData(
      userId,
      currentActiveAlarms + 1,
      currentTotalAlarms + 1,
      undefined,
      false, // FALSE: non assegna XP per la creazione
      true
    );
  }

  /**
   * Questo metodo dovrebbe essere chiamato dal componente/logica che gestisce l'eliminazione/disattivazione di una sveglia.
   * Decrementa il conteggio delle sveglie attive. NON assegna XP.
   * @param userId L'ID dell'utente.
   */
  async onAlarmDeactivatedOrDeleted(userId: string) {
    if (!userId) {
      console.warn('onAlarmDeactivatedOrDeleted: Tentativo senza userId.');
      return;
    }

    const userDocRef = doc(collection(this.firestore, 'users'), userId);
    const userDocSnap = await getDoc(userDocRef);
    let currentActiveAlarms = 0;
    let currentTotalAlarms = 0; // Il totale non cambia con la disattivazione/eliminazione di una singola sveglia esistente.
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      currentActiveAlarms = userData['activeAlarmsCount'] || 0;
      currentTotalAlarms = userData['totalAlarmsCount'] || 0;
    }

    // Decrementiamo activeAlarmsCount. Il totalAlarmsCount rimane invariato se la sveglia era già esistente.
    const newActiveAlarms = Math.max(0, currentActiveAlarms - 1);

    // Chiama il metodo principale per aggiornare i dati e l'attività globale
    await this.updateAlarmData(
      userId,
      newActiveAlarms,
      currentTotalAlarms, // Il totale rimane invariato
      undefined,
      false, // NON assegna XP
      false
    );
  }
}
