import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, getDoc } from '@angular/fire/firestore'; // Aggiungi updateDoc e getDoc
import { ExpService } from './exp.service'; // Importa ExpService

@Injectable({
  providedIn: 'root'
})
export class UserAlarmDataService {

  constructor(
    private firestore: Firestore,
    private expService: ExpService // Inietta ExpService
  ) { }

  /**
   * Aggiorna i dati delle sveglie per un utente e, se specificato, aggiunge XP.
   * Questo metodo dovrebbe essere chiamato quando le metriche delle sveglie cambiano.
   * @param userId L'ID dell'utente.
   * @param activeCount Il numero di sveglie attive.
   * @param totalCreated Il numero totale di sveglie create.
   * @param alarmStreak (Opzionale) La streak delle sveglie.
   * @param completedAlarm (Opzionale) Se la chiamata è dovuta al completamento di una sveglia, per aggiungere XP.
   * @param createdNewAlarm (Opzionale) Se la chiamata è dovuta alla creazione di una nuova sveglia, per aggiungere XP.
   */
  async updateAlarmData(
    userId: string,
    activeCount: number,
    totalCreated: number,
    alarmStreak?: number,
    completedAlarm: boolean = false, // Nuovo parametro per trigger XP
    createdNewAlarm: boolean = false // Nuovo parametro per trigger XP
  ) {
    if (!userId) {
      console.warn('UserAlarmDataService: Tentativo di aggiornare dati sveglie senza userId.');
      return;
    }

    const userRef = doc(collection(this.firestore, 'users'), userId);
    const dataToUpdate: any = {
      activeAlarmsCount: activeCount,
      totalAlarmsCreated: totalCreated,
      lastAlarmInteraction: new Date().toISOString() // Meglio usare ISO string per data/ora
    };

    if (alarmStreak !== undefined) {
      dataToUpdate.alarmStreak = alarmStreak;
    }

    try {
      // Per prima cosa, salva i dati dei contatori su Firebase
      await setDoc(userRef, dataToUpdate, { merge: true });
      console.log(`Dati sveglie aggiornati per utente ${userId} su Firebase.`);

      // Adesso, aggiungi gli XP se l'azione lo richiede
      if (completedAlarm) {
        this.expService.addExperience(20); // XP per sveglia completata
        console.log(`[UserAlarmDataService] XP aggiunti per completamento sveglia.`);
      }
      if (createdNewAlarm) {
        this.expService.addExperience(5); // XP per creazione nuova sveglia
        console.log(`[UserAlarmDataService] XP aggiunti per creazione nuova sveglia.`);
      }

    } catch (error) {
      console.error('Errore aggiornamento dati sveglie su Firebase:', error);
      // Potresti voler propagare l'errore o gestirlo in modo più robusto
      throw error;
    }
  }

  // Esempio di come potresti chiamare updateAlarmData dall'esterno
  // Questo metodo dovrebbe essere chiamato dal componente/logica che gestisce lo spegnimento della sveglia
  async onAlarmSuccessfullyDismissed(userId: string) {
    // Recupera i dati attuali dell'utente per aggiornarli
    const userDocRef = doc(collection(this.firestore, 'users'), userId);
    const userDocSnap = await getDoc(userDocRef);
    let currentActiveAlarms = 0;
    let currentTotalAlarms = 0;
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      currentActiveAlarms = userData['activeAlarmsCount'] || 0;
      currentTotalAlarms = userData['totalAlarmsCreated'] || 0;
    }

    // Qui potresti decrementare activeAlarmsCount se la sveglia è stata disattivata dopo il completamento
    // Per semplicità, ipotizziamo che il completamento della sveglia non ne riduca il conteggio attivo automaticamente qui.
    // L'importante è che chiami 'completedAlarm: true'.
    await this.updateAlarmData(
      userId,
      currentActiveAlarms, // O currentActiveAlarms - 1 se il completamento la disattiva
      currentTotalAlarms,
      undefined, // Non aggiornare la streak qui per esempio
      true, // È stata completata una sveglia
      false // Non è stata creata una nuova sveglia
    );
  }

  // Questo metodo dovrebbe essere chiamato dal componente/logica che gestisce la creazione di una sveglia
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
      currentActiveAlarms + 1, // Una nuova sveglia è attiva
      currentTotalAlarms + 1, // Totale sveglie create incrementa
      undefined,
      false, // Non è un completamento
      true // È una creazione
    );
  }
}
