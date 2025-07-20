import { Injectable } from '@angular/core';
import { getAuth, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, getFirestore, updateDoc, increment } from 'firebase/firestore';
import { ExpService } from './exp.service';
import { BehaviorSubject, Observable } from 'rxjs';

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
  lastGlobalActivityTimestamp?: string;
  totalPhotosShared?: number;
  lastPhotoSharedInteraction?: string;
  diaryTotalWords?: number;
  diaryLastInteraction?: string;
  diaryEntryCount?: number;
  totalXP?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserDataService {

  private db = getFirestore();
  private firestore = getFirestore();
  private auth = getAuth();

  private _userStatus = new BehaviorSubject<string>(''); // Default: neutral
  public userStatus$ = this._userStatus.asObservable();

  constructor(private expService: ExpService) {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userData = await this.getUserData(); // getUserData assicura che totalXP sia caricato e settato
        if (userData && typeof userData['totalXP'] === 'number') {
          this.expService.setTotalXP(userData['totalXP']);
        } else {
          // Se totalXP non esiste, lo inizializza a 0 anche nel servizio ExpService
          this.expService.setTotalXP(0);
        }
      } else {
        this.expService.setTotalXP(0);
        this._userStatus.next(''); // Resetta lo status al logout
      }
    });

    // Questa sottoscrizione salva gli XP su Firebase ogni volta che cambiano nel servizio ExpService
    this.expService.totalXP$.subscribe(async (newTotalXP) => {
      const user = this.auth.currentUser;
      if (user) {
        const userDocRef = doc(this.firestore, 'users', user.uid);
        try {
          await updateDoc(userDocRef, { totalXP: newTotalXP });
        } catch (error) {
          console.error("Errore nell'aggiornamento dell'XP totale:", error);
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

        // ⭐ Aggiorna il BehaviorSubject dello status se il campo è stato modificato/passato
        if (dataToSave.status !== undefined) {
          this._userStatus.next(dataToSave.status ?? '');
        }

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
        let data: any;

        if (docSnap.exists()) {
          data = docSnap.data();
          // ⭐ NOVITÀ: Assicurati che 'totalXP' esista e sia inizializzato a 0 se manca
          if (typeof data['totalXP'] === 'undefined') {
            await updateDoc(userDocRef, { totalXP: 0 });
            data.totalXP = 0;
          }
          // Assicurati che altri campi esistano o abbiano valori di fallback
          if (typeof data['lastGlobalActivityTimestamp'] === 'undefined') {
            await updateDoc(userDocRef, { lastGlobalActivityTimestamp: '' });
            data.lastGlobalActivityTimestamp = '';
          }
          data.status = data.status ?? ''; // Se è null/undefined, imposta a ''; altrimenti mantiene il valore esistente

          // ⭐ NOVITÀ: Assicurati che i campi del diario esistano o abbiano valori di fallback
          data.diaryTotalWords = data.diaryTotalWords ?? 0;
          data.diaryLastInteraction = data.diaryLastInteraction ?? '';
          data.diaryEntryCount = data.diaryEntryCount ?? 0;

        } else {
          // ⭐ NOVITÀ: Crea il documento con i dati iniziali, inclusi totalXP e i campi del diario
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
            lastGlobalActivityTimestamp: '',
            totalPhotosShared: 0,
            lastPhotoSharedInteraction: '',
            status: '',
            diaryTotalWords: 0,
            diaryLastInteraction: '',
            diaryEntryCount: 0,
          };
          await setDoc(userDocRef, initialData);
          console.log("Documento utente creato con dati iniziali per UID:", user.uid);
          data = initialData;
        }

        this._userStatus.next(data.status); // Aggiorna il BehaviorSubject dello status

        return data;
      } catch (error) {
        console.error("Errore nel recupero/creazione dei dati utente:", error);
        this._userStatus.next(''); // Resetta il BehaviorSubject dello status in caso di errore
        return null;
      }
    } else {
      console.warn("Nessun utente loggato. Impossibile recuperare i dati utente.");
      this._userStatus.next(''); // Resetta il BehaviorSubject dello status se non c'è utente
      return null;
    }
  }

  async updateUserStatus(status: string): Promise<void> {
    const uid = this.getUserUid();
    if (uid) {
      await this.updateStringField(uid, 'status', status);
      this._userStatus.next(status); // Aggiorna il BehaviorSubject
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
  private async updateNumericField(uid: string, field: string, valueToUpdate: number | 'increment', setValue?: number): Promise<void> {
    const userDocRef = doc(this.firestore, 'users', uid);
    try {
      const updateData: { [key: string]: any } = {};

      if (setValue !== undefined) {
        // Se setValue è fornito, imposta il valore esatto
        updateData[field] = setValue;
      } else if (valueToUpdate === 'increment') {
        // Incrementa di 1
        updateData[field] = increment(1);
      } else if (typeof valueToUpdate === 'number') {
        // Incrementa del valore numerico specificato
        updateData[field] = increment(valueToUpdate);
      } else {
        console.warn(`[UserDataService] Tipo di 'valueToUpdate' non supportato per il campo '${field}': ${valueToUpdate}`);
        return;
      }

      await updateDoc(userDocRef, updateData);
      console.log(`[UserDataService] Campo '${field}' aggiornato.`);
    } catch (error) {
      // Se il documento non esiste (codice 'not-found'), proviamo a crearlo con il valore iniziale.
      // Questo è cruciale per i campi che vengono incrementati e potrebbero non esistere ancora.
      if ((error as any).code === 'not-found') {
        console.warn(`Documento utente per UID ${uid} non trovato per aggiornare il campo '${field}'. Provando a crearlo.`);
        let initialValue = 0;
        if (setValue !== undefined) {
          initialValue = setValue;
        } else if (valueToUpdate === 'increment' || typeof valueToUpdate === 'number') {
          // Se si tenta di incrementare un campo non esistente, lo inizializziamo con il valore di incremento (o 1)
          initialValue = typeof valueToUpdate === 'number' ? valueToUpdate : 1;
        }
        await setDoc(userDocRef, { [field]: initialValue }, { merge: true });
        console.log(`Documento utente per UID ${uid} creato con valore iniziale per '${field}': ${initialValue}.`);
      } else {
        console.error(`Errore nell'aggiornamento del campo '${field}' per UID ${uid}:`, error);
        throw error;
      }
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

  /**
     * Aggiorna il conteggio delle parole/caratteri totali scritti nel diario.
     * Utilizza 'increment' per aggiungere la nuova lunghezza del testo.
     * @param length La lunghezza (parole o caratteri) del testo della voce del diario.
     */
  async incrementDiaryTotalWords(length: number): Promise<void> {
    const uid = this.getUserUid();
    if (uid) {
      await this.updateNumericField(uid, 'diaryTotalWords', length);
      await this.setLastGlobalActivityTimestamp(new Date().toISOString());
    }
  }

  /**
     * Imposta il timestamp dell'ultima interazione con il diario.
     * @param timestamp La stringa ISO del timestamp.
     */
  async setDiaryLastInteraction(timestamp: string): Promise<void> {
    const uid = this.getUserUid();
    if (uid) {
      await this.updateStringField(uid, 'diaryLastInteraction', timestamp);
      await this.setLastGlobalActivityTimestamp(timestamp);
    }
  }

  /**
     * Incrementa il contatore dei giorni distinti in cui è stata scritta una voce del diario.
     * Questo metodo dovrebbe essere chiamato solo quando viene creata una *nuova* voce per un *nuovo* giorno.
     */
  async incrementDiaryEntryCount(): Promise<void> {
    const uid = this.getUserUid();
    if (uid) {
      await this.updateNumericField(uid, 'diaryEntryCount', 'increment');
    }
  }
}
