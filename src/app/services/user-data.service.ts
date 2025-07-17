import { Injectable } from '@angular/core';
import { getAuth, User } from 'firebase/auth'; // Importa User da firebase/auth
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, getFirestore, updateDoc } from 'firebase/firestore'; // Aggiungi updateDoc
import { ExpService } from './exp.service'; // Importa ExpService

// Interfaccia per i dati che il UserDataService gestirà direttamente da Firebase
export interface UserDashboardCounts {
  activeAlarmsCount: number;
  totalAlarmsCreated: number;
  lastAlarmInteraction: string;
  totalNotesCount: number;
  totalListsCount: number;
  incompleteListItems: number;
  lastNoteListInteraction: string;
  followersCount: number;
  followingCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserDataService {
  private db = getFirestore();
  private firestore = getFirestore();
  private auth = getAuth();

  constructor(private expService: ExpService) { // Inietta ExpService
    // Quando l'utente si autentica o rileva un cambiamento nell'autenticazione,
    // inizializza ExpService con gli XP dell'utente corrente.
    // Questo è un punto di integrazione cruciale tra i due servizi.
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userData = await this.getUserData();
        if (userData && typeof userData['totalXP'] === 'number') {
          this.expService.setTotalXP(userData['totalXP']);
        } else {
          // Se l'utente non ha ancora XP, inizializza a 0
          this.expService.setTotalXP(0);
        }
      } else {
        // Utente disconnesso, resetta gli XP nel servizio ExpService
        this.expService.setTotalXP(0);
      }
    });

    // Sottoscriviti ai cambiamenti di XP in ExpService per salvarli su Firebase
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

  // Metodo esistente, leggermente pulito e tipizzato
  async saveUserData(data: Partial<any>): Promise<void> { // data: Partial<any> per essere più flessibile
    const user = this.auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'users', user.uid);
      const dataToSave: any = { ...data }; // Crea una copia per evitare modifiche dirette all'input

      if (dataToSave.nickname !== undefined) { // Controlla se nickname è presente e non null
        dataToSave.nicknameLowercase = (dataToSave.nickname || '').toLowerCase().trim();
      }

      if (dataToSave.name !== undefined) { // Controlla se name è presente e non null
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

  // Metodo esistente per la ricerca
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

  // Metodo esistente, leggermente pulito
  async getUserDataByUid(uid: string): Promise<any | null> {
    const userDocRef = doc(this.db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      return userDocSnap.data();
    }
    return null;
  }

  // Metodo esistente, aggiornato per recuperare tutti i dati dell'utente, incluso totalXP
  async getUserData(): Promise<any | null> {
    const user = this.auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'users', user.uid);
      try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Assicurati che totalXP esista, altrimenti default a 0
          if (typeof data['totalXP'] === 'undefined') {
            await updateDoc(userDocRef, { totalXP: 0 }); // Inizializza totalXP se mancante
            return { ...data, totalXP: 0 };
          }
          return data;
        } else {
          // Se il documento utente non esiste, creane uno di base e inizializza totalXP a 0
          const initialData = { totalXP: 0, activeAlarmsCount: 0, totalAlarmsCreated: 0, lastAlarmInteraction: '',
                                totalNotesCount: 0, totalListsCount: 0, incompleteListItems: 0, lastNoteListInteraction: '',
                                followersCount: 0, followingCount: 0 };
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

  // Metodo esistente
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
        console.warn(`Documento utente per UID ${uid} non trovato per aggiornare il campo '${field}'.`);
        throw new Error(`Documento utente per UID ${uid} non trovato.`);
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
  async incrementTotalNotesCount(): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'totalNotesCount', 1);
  }

  async incrementTotalListsCount(): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'totalListsCount', 1);
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

  // *** Questo metodo NON è più usato per il dashboard direttamente, ma potresti usarlo in altri contesti ***
  // public getDashboardData(): Observable<UserDashboardData> {
  //   // Questo metodo non è più responsabile di combinare i dati XP.
  //   // La logica di combinazione sarà nel DashboardUtenteComponent o in un altro servizio.
  //   // Se ti serve ancora un Observable per i dati di base (non XP), puoi implementarlo qui
  //   // usando onSnapshot o valueChanges per stream continui da Firebase.
  //   // Per ora, ci basiamo su chiamate asincrone one-off.
  //   throw new Error("getDashboardData non è più implementato in UserDataService per questo scopo. Usare getUserData() per un'unica lettura.");
  // }
}
