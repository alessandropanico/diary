import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, getDoc } from '@angular/fire/firestore';
import { ExpService } from './exp.service';
// Non è necessario importare UserDataService in questo file se non viene usato direttamente per refreshDashboardData qui
// Se in futuro deciderai di rimettere la notifica alla dashboard da qui, dovrai importarlo.

@Injectable({
  providedIn: 'root'
})
export class UserAlarmDataService {

  constructor(
    private firestore: Firestore,
    private expService: ExpService
  ) { }

  /**
   * Aggiorna i dati delle sveglie per un utente e, se specificato, aggiunge XP.
   * Questo metodo dovrebbe essere chiamato quando le metriche delle sveglie cambiano.
   * @param userId L'ID dell'utente.
   * @param activeCount Il numero di sveglie attive.
   * @param totalCreated Il numero totale di sveglie create.
   * @param alarmStreak (Opzionale) La streak delle sveglie.
   * @param completedAlarm (Opzionale) Se la chiamata è dovuta al completamento di una sveglia, per aggiungere XP.
   * @param createdNewAlarm (Opzionale) Se la chiamata è dovuta alla creazione di una nuova sveglia.
   */
  async updateAlarmData(
    userId: string,
    activeCount: number,
    totalCreated: number,
    alarmStreak?: number,
    completedAlarm: boolean = false, // Questo trigger XP
    createdNewAlarm: boolean = false // Questo non triggera più XP
  ) {
    if (!userId) {
      console.warn('UserAlarmDataService: Tentativo di aggiornare dati sveglie senza userId.');
      return;
    }

    const userRef = doc(collection(this.firestore, 'users'), userId);
    const dataToUpdate: any = {
      activeAlarmsCount: activeCount,
      totalAlarmsCreated: totalCreated,
      lastAlarmInteraction: new Date().toISOString()
    };

    if (alarmStreak !== undefined) {
      dataToUpdate.alarmStreak = alarmStreak;
    }

    try {
      // Per prima cosa, salva i dati dei contatori su Firebase
      await setDoc(userRef, dataToUpdate, { merge: true });
      console.log(`Dati sveglie aggiornati per utente ${userId} su Firebase.`);

      // Adesso, aggiungi gli XP SOLO se la sveglia è stata completata
      if (completedAlarm) {
        this.expService.addExperience(20); // XP per sveglia completata
        console.log(`[UserAlarmDataService] XP aggiunti per completamento sveglia.`);
      }
      // ⭐ RIMOSSA la condizione per createdNewAlarm: gli XP non vengono più dati per la creazione.
      // if (createdNewAlarm) {
      //   this.expService.addExperience(5);
      //   console.log(`[UserAlarmDataService] XP aggiunti per creazione nuova sveglia.`);
      // }

    } catch (error) {
      console.error('Errore aggiornamento dati sveglie su Firebase:', error);
      throw error;
    }
  }

  /**
   * Questo metodo dovrebbe essere chiamato dal componente/logica che gestisce lo spegnimento della sveglia.
   * Aggiorna i contatori e assegna XP per il completamento.
   * @param userId L'ID dell'utente.
   */
  async onAlarmSuccessfullyDismissed(userId: string) {
    const userDocRef = doc(collection(this.firestore, 'users'), userId);
    const userDocSnap = await getDoc(userDocRef);
    let currentActiveAlarms = 0;
    let currentTotalAlarms = 0;
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      currentActiveAlarms = userData['activeAlarmsCount'] || 0;
      currentTotalAlarms = userData['totalAlarmsCreated'] || 0;
    }

    await this.updateAlarmData(
      userId,
      currentActiveAlarms,
      currentTotalAlarms,
      undefined,
      true, // ⭐ TRUE: assegna XP per il completamento
      false
    );
  }

  /**
   * Questo metodo dovrebbe essere chiamato dal componente/logica che gestisce la creazione di una sveglia.
   * Aggiorna i contatori ma NON assegna XP.
   * @param userId L'ID dell'utente.
   */
  async onAlarmCreated(userId: string) {
    const userDocRef = doc(collection(this.firestore, 'users'), userId);
    const userDocSnap = await getDoc(userDocRef);
    let currentActiveAlarms = 0;
    let currentTotalAlarms = 0;
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      currentActiveAlarms = userData['activeAlarmsCount'] || 0;
      currentTotalAlarms = userData['totalAlarmsCreated'] || 0;
    }

    await this.updateAlarmData(
      userId,
      currentActiveAlarms + 1,
      currentTotalAlarms + 1,
      undefined,
      false, // ⭐ FALSE: non assegna XP per la creazione
      true
    );
  }
}
