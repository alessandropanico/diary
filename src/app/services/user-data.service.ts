import { Injectable } from '@angular/core';
import { getAuth, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, getFirestore, updateDoc } from 'firebase/firestore';
import { ExpService } from './exp.service';

export interface UserDashboardCounts {
  activeAlarmsCount: number;
  totalAlarmsCount: number;
  lastAlarmInteraction: string;
  totalNotesCount: number;
  totalListsCount: number;
  incompleteListItems: number;
  lastNoteListInteraction: string;
  followersCount: number;
  followingCount: number;
  lastGlobalActivityTimestamp?: string; // Ora traccia l'ultima attività generale
  totalPhotosShared?: number; // Nuova proprietà per il conteggio delle foto condivise
  lastPhotoSharedInteraction?: string; // Nuova proprietà per l'ultima interazi
}

@Injectable({
  providedIn: 'root'
})
export class UserDataService {
  private db = getFirestore();
  private firestore = getFirestore();
  private auth = getAuth();

  constructor(private expService: ExpService) {
this.auth.onAuthStateChanged(async (user) => {
  if (user) {
    const userData = await this.getUserData();
    console.log("[UserDataService] Dati utente caricati all'autenticazione:", userData);
    if (userData && typeof userData['totalXP'] === 'number') {
      this.expService.setTotalXP(userData['totalXP']);
      console.log(`[UserDataService] totalXP impostato da Firebase: ${userData['totalXP']}`);
    } else {
      this.expService.setTotalXP(0);
      console.log("[UserDataService] totalXP non trovato o non numerico, impostato a 0.");
    }
  } else {
    this.expService.setTotalXP(0);
    console.log("[UserDataService] Utente disconnesso, totalXP impostato a 0.");
  }
});

    this.expService.totalXP$.subscribe(async (newTotalXP) => {
      const user = this.auth.currentUser;
      if (user) {
        const userDocRef = doc(this.firestore, 'users', user.uid);
        try {
          await updateDoc(userDocRef, { totalXP: newTotalXP });
          console.log(`[UserDataService] totalXP salvato su Firebase: ${newTotalXP}`);
        } catch (error) {
          console.error("Errore nel salvataggio di totalXP su Firebase:", error);
        }
      }
    });
  }

  private getUserUid(): string | null {
    const user = this.auth.currentUser;
    return user ? user.uid : null;
  }

  async saveUserData(data: Partial<any>): Promise<void> {
    const user = this.auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'users', user.uid);
      const dataToSave: any = { ...data };

      if (dataToSave.nickname !== undefined) {
        dataToSave.nicknameLowercase = (dataToSave.nickname || '').toLowerCase().trim();
      }

      if (dataToSave.name !== undefined) {
        dataToSave.nameLowercase = (dataToSave.name || '').toLowerCase().trim();
      }

      try {
        await setDoc(userDocRef, dataToSave, { merge: true });
        console.log("Dati utente salvati con successo per UID:", user.uid);
      } catch (error) {
        console.error("Errore nel salvataggio dei dati utente:", error);
        throw error;
      }
    } else {
      console.warn("Nessun utente loggato. Impossibile salvare i dati utente.");
      throw new Error("Utente non autenticato.");
    }
  }

  async searchUsers(searchTerm: string): Promise<any[]> {
    const normalizedSearchTerm = searchTerm.toLowerCase().trim();
    if (!normalizedSearchTerm) {
      return [];
    }

    const usersRef = collection(this.db, 'users');
    const allResults: any[] = [];
    const addedUids = new Set<string>();

    const queryByNickname = query(
      usersRef,
      where('nicknameLowercase', '>=', normalizedSearchTerm),
      where('nicknameLowercase', '<=', normalizedSearchTerm + '\uf8ff'),
      orderBy('nicknameLowercase'),
      limit(10)
    );
    const snapshotNickname = await getDocs(queryByNickname);
    snapshotNickname.forEach((doc) => {
      const userData = doc.data();
      if (!addedUids.has(doc.id)) {
        allResults.push({
          uid: doc.id,
          nickname: userData['nickname'],
          name: userData['name'],
          photo: userData['photo'],
          bio: userData['bio']
        });
        addedUids.add(doc.id);
      }
    });

    const queryByName = query(
      usersRef,
      where('nameLowercase', '>=', normalizedSearchTerm),
      where('nameLowercase', '<=', normalizedSearchTerm + '\uf8ff'),
      orderBy('nameLowercase'),
      limit(10)
    );
    const snapshotName = await getDocs(queryByName);
    snapshotName.forEach((doc) => {
      const userData = doc.data();
      if (!addedUids.has(doc.id)) {
        allResults.push({
          uid: doc.id,
          nickname: userData['nickname'],
          name: userData['name'],
          photo: userData['photo'],
          bio: userData['bio']
        });
        addedUids.add(doc.id);
      }
    });

    allResults.sort((a, b) => a.nickname.localeCompare(b.nickname));
    return allResults;
  }

  async getUserDataByUid(uid: string): Promise<any | null> {
    const userDocRef = doc(this.db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      return userDocSnap.data();
    }
    return null;
  }

 async getUserData(): Promise<any | null> {
    const user = this.auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'users', user.uid);
      try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (typeof data['totalXP'] === 'undefined') {
            await updateDoc(userDocRef, { totalXP: 0 });
            return { ...data, totalXP: 0 };
          }
           // ⭐ Assicurati che lastGlobalActivityTimestamp sia presente o inizializzato
           if (typeof data['lastGlobalActivityTimestamp'] === 'undefined') {
              await updateDoc(userDocRef, { lastGlobalActivityTimestamp: '' }); // O una data predefinita
              return { ...data, lastGlobalActivityTimestamp: '' };
           }
          return data;
        } else {
          const initialData = {
              totalXP: 0,
              activeAlarmsCount: 0,
              totalAlarmsCreated: 0,
              lastAlarmInteraction: '',
              totalNotesCount: 0,
              totalListsCount: 0,
              incompleteListItems: 0,
              lastNoteListInteraction: '',
              followersCount: 0,
              followingCount: 0,
              // ⭐ AGGIUNGI IL NUOVO CAMPO QUI ALL'INIZIALIZZAZIONE
              lastGlobalActivityTimestamp: ''
            };
          await setDoc(userDocRef, initialData);
          console.log("Documento utente creato con dati iniziali per UID:", user.uid);
          return initialData;
        }
      } catch (error) {
        console.error("Errore nel recupero/creazione dei dati utente:", error);
        return null;
      }
    } else {
      console.warn("Nessun utente loggato. Impossibile recuperare i dati utente.");
      return null;
    }
  }

  async getUserDataById(uid: string): Promise<any | null> {
    if (!uid) {
      console.warn("UID utente non fornito per getUserDataById.");
      return null;
    }
    const userDocRef = doc(this.firestore, 'users', uid);
    try {
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        return { uid: userDocSnap.id, ...data };
      }
      return null;
    } catch (error) {
      console.error("Errore nel recupero dati utente per UID:", uid, error);
      throw error;
    }
  }

  // --- Metodi Helper per l'aggiornamento dei campi ---

  // Helper per aggiornare un campo numerico incrementandolo o impostandolo
  private async updateNumericField(uid: string, field: string, incrementBy: number = 0, setValue?: number): Promise<void> {
    const userDocRef = doc(this.firestore, 'users', uid);
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        let currentValue = docSnap.data()?.[field] || 0;
        let newValue: number;

        if (setValue !== undefined) {
          newValue = setValue;
        } else {
          newValue = currentValue + incrementBy;
        }
        await updateDoc(userDocRef, { [field]: newValue });
        console.log(`[UserDataService] Campo '${field}' aggiornato a: ${newValue}`);
      } else {
        // Se il documento non esiste, lo crea con il valore iniziale.
        // Questo è utile se un utente non ha ancora un documento e viene chiamato un metodo come increment.
        const initialValue = setValue !== undefined ? setValue : incrementBy;
        await setDoc(userDocRef, { [field]: initialValue }, { merge: true });
        console.warn(`Documento utente per UID ${uid} non trovato per aggiornare il campo '${field}'. Creato con valore iniziale: ${initialValue}.`);
      }
    } catch (error) {
      console.error(`Errore nell'aggiornamento del campo '${field}' per UID ${uid}:`, error);
      throw error;
    }
  }

  // Helper per aggiornare un campo stringa
  private async updateStringField(uid: string, field: string, value: string): Promise<void> {
    const userDocRef = doc(this.firestore, 'users', uid);
    try {
      await updateDoc(userDocRef, { [field]: value });
      console.log(`[UserDataService] Campo '${field}' aggiornato a: ${value}`);
    } catch (error) {
      console.error(`Errore nell'aggiornamento del campo '${field}' per UID ${uid}:`, error);
      throw error;
    }
  }

  // --- Metodi Specifici per aggiornare i contatori ---

  // Metodi per le Sveglie
  async incrementTotalAlarmsCreated(): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'totalAlarmsCreated', 1);
  }

  async setActiveAlarmsCount(count: number): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'activeAlarmsCount', 0, count);
  }

  async setLastAlarmInteraction(timestamp: string): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateStringField(uid, 'lastAlarmInteraction', timestamp);
  }

  // Metodi per Note e Liste
  // Modificato: accetta un parametro 'change' con default 1
  async incrementTotalNotesCount(change: number = 1): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'totalNotesCount', change);
  }

  // Modificato: accetta un parametro 'change' con default 1
  async incrementTotalListsCount(change: number = 1): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'totalListsCount', change);
  }

  async setIncompleteListItems(count: number): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'incompleteListItems', 0, count);
  }

  async setLastNoteListInteraction(timestamp: string): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateStringField(uid, 'lastNoteListInteraction', timestamp);
  }

  // Metodi per Follower e Seguiti
  async incrementFollowersCount(): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'followersCount', 1);
  }

  async incrementFollowingCount(): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'followingCount', 1);
  }

  async setTotalNotesCount(count: number): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'totalNotesCount', 0, count);
  }

  async setTotalListsCount(count: number): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'totalListsCount', 0, count);
  }

  // *** Questo metodo NON è più usato per il dashboard direttamente, ma potresti usarlo in altri contesti ***
  // public getDashboardData(): Observable<UserDashboardData> {
  //   // Questo metodo non è più responsabile di combinare i dati XP.
  //   // La logica di combinazione sarà nel DashboardUtenteComponent o in un altro servizio.
  //   // Se ti serve ancora un Observable per i dati di base (non XP), puoi implementarlo qui
  //   // usando onSnapshot o valueChanges per stream continui da Firebase.
  //   // Per ora, ci basiamo su chiamate asincrone one-off.
  //   throw new Error("getDashboardData non è più implementato in UserDataService per questo scopo. Usare getUserData() per un'unica lettura.");
  // }

// All'interno della classe UserDataService { ... }

async incrementTotalPhotosShared(): Promise<void> {
  const uid = this.getUserUid();
  if (uid) {
    await this.updateNumericField(uid, 'totalPhotosShared', 1);
    await this.setLastGlobalActivityTimestamp(new Date().toISOString());
  }
}

async setLastPhotoSharedInteraction(timestamp: string): Promise<void> {
  const uid = this.getUserUid();
  if (uid) {
    await this.updateStringField(uid, 'lastPhotoSharedInteraction', timestamp);
    await this.setLastGlobalActivityTimestamp(timestamp);
  }
}

async setLastGlobalActivityTimestamp(timestamp: string): Promise<void> {
  const uid = this.getUserUid();
  if (uid) {
    await this.updateStringField(uid, 'lastGlobalActivityTimestamp', timestamp);
  }
}
}
