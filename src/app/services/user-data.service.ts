import { Injectable } from '@angular/core';
import { getAuth, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, getFirestore, updateDoc, increment, DocumentData, QueryDocumentSnapshot, startAfter } from 'firebase/firestore'; // Importa DocumentData, QueryDocumentSnapshot, startAfter
import { ExpService } from './exp.service';
import { BehaviorSubject, Observable, from } from 'rxjs';

export interface UserDashboardCounts {

  uid: string;
  activeAlarmsCount: number;
  totalAlarmsCount: number;
  lastAlarmInteraction: string;

  totalNotesCount: number;
  totalListsCount: number;
  incompleteListItems: number;
  lastNoteListInteraction: string;

  lastNoteInteraction?: string;
  lastTaskInteraction?: string;
  incompleteTaskItems?: number;

  followersCount: number;
  followingCount: number;
  lastGlobalActivityTimestamp?: string;
  totalPhotosShared?: number;
  lastPhotoSharedInteraction?: string;
  diaryTotalWords?: number;
  diaryLastInteraction?: string;
  diaryEntryCount?: number;
  totalXP?: number;
  nickname?: string;
  name?: string;
  surname?: string;
  profilePictureUrl?: string;
  photo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserDataService {

  private db = getFirestore();
  private firestore = getFirestore();
  private auth = getAuth();


  private _userStatus = new BehaviorSubject<string>('');
  public userStatus$ = this._userStatus.asObservable();

  constructor(private expService: ExpService) {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userData = await this.getUserData();
        if (userData && typeof userData['totalXP'] === 'number') {
          this.expService.setTotalXP(userData['totalXP']);
        } else {
          this.expService.setTotalXP(0);
        }
      } else {
        this.expService.setTotalXP(0);
        this._userStatus.next('');
      }
    });

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

          if (typeof data['totalXP'] === 'undefined') {
            await updateDoc(userDocRef, { totalXP: 0 });
            data.totalXP = 0;
          }
          if (typeof data['profilePictureUrl'] === 'undefined' || data['profilePictureUrl'] === '') {
            await updateDoc(userDocRef, { profilePictureUrl: '' });
            data.profilePictureUrl = '';
          }
          if (typeof data['nicknameLowercase'] === 'undefined' && data['nickname']) {
            await updateDoc(userDocRef, { nicknameLowercase: (data['nickname'] || '').toLowerCase().trim() });
            data.nicknameLowercase = (data['nickname'] || '').toLowerCase().trim();
          }
          if (typeof data['nameLowercase'] === 'undefined' && data['name']) {
            await updateDoc(userDocRef, { nameLowercase: (data['name'] || '').toLowerCase().trim() });
            data.nameLowercase = (data['name'] || '').toLowerCase().trim();
          }

          if (typeof data['lastGlobalActivityTimestamp'] === 'undefined') {
            await updateDoc(userDocRef, { lastGlobalActivityTimestamp: '' });
            data.lastGlobalActivityTimestamp = '';
          }
          data.status = data.status ?? '';
          data.diaryTotalWords = data.diaryTotalWords ?? 0;
          data.diaryLastInteraction = data.diaryLastInteraction ?? '';
          data.diaryEntryCount = data.diaryEntryCount ?? 0;

          data.lastNoteInteraction = data.lastNoteInteraction ?? '';
          data.lastTaskInteraction = data.lastTaskInteraction ?? '';
          data.incompleteTaskItems = data.incompleteTaskItems ?? 0;

        } else {

          const initialData = {
            totalXP: 0,
            profilePictureUrl: '',
            nicknameLowercase: '',
            nameLowercase: '',
            activeAlarmsCount: 0,
            totalAlarmsCreated: 0,
            lastAlarmInteraction: '',

            lastNoteInteraction: '',
            lastTaskInteraction: '',
            incompleteTaskItems: 0,

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
          data = initialData;
        }

        this._userStatus.next(data.status);

        return data;
      } catch (error) {
        console.error("Errore nel recupero/creazione dei dati utente:", error);
        this._userStatus.next('');
        return null;
      }
    } else {
      console.warn("Nessun utente loggato. Impossibile recuperare i dati utente.");
      this._userStatus.next('');
      return null;
    }
  }

  async updateUserStatus(status: string): Promise<void> {
    const uid = this.getUserUid();
    if (uid) {
      await this.updateStringField(uid, 'status', status);
      this._userStatus.next(status);
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

  private async updateNumericField(uid: string, field: string, valueToUpdate: number | 'increment', setValue?: number): Promise<void> {
    const userDocRef = doc(this.firestore, 'users', uid);
    try {
      const updateData: { [key: string]: any } = {};

      if (setValue !== undefined) {
        updateData[field] = setValue;
      } else if (valueToUpdate === 'increment') {
        updateData[field] = increment(1);
      } else if (typeof valueToUpdate === 'number') {
        updateData[field] = increment(valueToUpdate);
      } else {
        console.warn(`[UserDataService] Tipo di 'valueToUpdate' non supportato per il campo '${field}': ${valueToUpdate}`);
        return;
      }

      await updateDoc(userDocRef, updateData);
      console.log(`[UserDataService] Campo '${field}' aggiornato.`);

      if (['activeAlarmsCount', 'totalNotesCount', 'totalListsCount', 'incompleteListItems', 'diaryTotalWords', 'diaryEntryCount', 'totalPhotosShared', 'incompleteTaskItems'].includes(field)) { // Aggiunto 'incompleteTaskItems'
        await this.setLastGlobalActivityTimestamp(new Date().toISOString());
      }
    } catch (error) {
      if ((error as any).code === 'not-found') {
        console.warn(`Documento utente per UID ${uid} non trovato per aggiornare il campo '${field}'. Provando a crearlo.`);
        let initialValue = 0;
        if (setValue !== undefined) {
          initialValue = setValue;
        } else if (valueToUpdate === 'increment' || typeof valueToUpdate === 'number') {
          initialValue = typeof valueToUpdate === 'number' ? valueToUpdate : 1;
        }
        await setDoc(userDocRef, { [field]: initialValue }, { merge: true });

        if (['activeAlarmsCount', 'totalNotesCount', 'totalListsCount', 'incompleteListItems', 'diaryTotalWords', 'diaryEntryCount', 'totalPhotosShared', 'incompleteTaskItems'].includes(field)) { // Aggiunto 'incompleteTaskItems'
          await this.setLastGlobalActivityTimestamp(new Date().toISOString());
        }
      } else {
        console.error(`Errore nell'aggiornamento del campo '${field}' per UID ${uid}:`, error);
        throw error;
      }
    }
  }

  private async updateStringField(uid: string, field: string, value: string): Promise<void> {
    const userDocRef = doc(this.firestore, 'users', uid);
    try {
      await updateDoc(userDocRef, { [field]: value });

      if (['lastAlarmInteraction', 'lastNoteInteraction', 'lastTaskInteraction', 'lastPhotoSharedInteraction', 'diaryLastInteraction', 'lastNoteListInteraction'].includes(field)) { // Aggiunto 'lastNoteListInteraction'
        await this.setLastGlobalActivityTimestamp(value);
      }
    } catch (error) {
      console.error(`Errore nell'aggiornamento del campo '${field}' per UID ${uid}:`, error);
      throw error;
    }
  }

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

  async incrementTotalNotesCount(change: number = 1): Promise<void> {
    const uid = this.getUserUid();
    if (uid) {
      await this.updateNumericField(uid, 'totalNotesCount', change);
      await this.setLastNoteInteraction(new Date().toISOString());
    }
  }

  async incrementTotalListsCount(change: number = 1): Promise<void> {
    const uid = this.getUserUid();
    if (uid) {
      await this.updateNumericField(uid, 'totalListsCount', change);
      await this.setLastTaskInteraction(new Date().toISOString());
    }
  }

  async setLastNoteInteraction(timestamp: string): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateStringField(uid, 'lastNoteInteraction', timestamp);
  }

  async setLastTaskInteraction(timestamp: string): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateStringField(uid, 'lastTaskInteraction', timestamp);
  }

  async setIncompleteTaskItems(count: number): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'incompleteTaskItems', 0, count);
  }

  async setIncompleteListItems(count: number): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateNumericField(uid, 'incompleteListItems', 0, count);
  }

  async setLastNoteListInteraction(timestamp: string): Promise<void> {
    const uid = this.getUserUid();
    if (uid) await this.updateStringField(uid, 'lastNoteListInteraction', timestamp);
  }

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

  async incrementDiaryEntryCount(): Promise<void> {
    const uid = this.getUserUid();
    if (uid) {
      await this.updateNumericField(uid, 'diaryEntryCount', 'increment');
    }
  }

  getLeaderboardUsers(
    pageSize: number,
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Observable<{ users: UserDashboardCounts[], lastVisible: QueryDocumentSnapshot<DocumentData> | null }> {
    const usersCollection = collection(this.firestore, 'users');

    let q = query(
      usersCollection,
      orderBy('totalXP', 'desc'),
      orderBy('nicknameLowercase', 'asc'),
      limit(pageSize)
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    return from(getDocs(q).then(snapshot => {
      const users: UserDashboardCounts[] = [];
      snapshot.forEach(doc => {
        const userData = doc.data();

        users.push({
          uid: doc.id,
          nickname: userData['nickname'] as string ?? 'N/A',
          name: userData['name'] as string ?? '',
          surname: userData['surname'] as string ?? '',
          photo: (userData['profilePictureUrl'] as string) || (userData['photo'] as string) || 'assets/immaginiGenerali/default-avatar.jpg', // ⭐ AGGIORNAMENTO: Preferisci profilePictureUrl, poi photo
          totalXP: userData['totalXP'] as number ?? 0,
          activeAlarmsCount: userData['activeAlarmsCount'] as number ?? 0,
          totalAlarmsCount: userData['totalAlarmsCount'] as number ?? 0,
          lastAlarmInteraction: userData['lastAlarmInteraction'] as string ?? '',
          totalNotesCount: userData['totalNotesCount'] as number ?? 0,
          totalListsCount: userData['totalListsCount'] as number ?? 0,
          incompleteListItems: userData['incompleteListItems'] as number ?? 0,
          lastNoteListInteraction: userData['lastNoteListInteraction'] as string ?? '',

          lastNoteInteraction: userData['lastNoteInteraction'] as string ?? '',
          lastTaskInteraction: userData['lastTaskInteraction'] as string ?? '',
          incompleteTaskItems: userData['incompleteTaskItems'] as number ?? 0,

          followersCount: userData['followersCount'] as number ?? 0,
          followingCount: userData['followingCount'] as number ?? 0,
          lastGlobalActivityTimestamp: userData['lastGlobalActivityTimestamp'] as string ?? '',
          totalPhotosShared: userData['totalPhotosShared'] as number ?? 0,
          lastPhotoSharedInteraction: userData['lastPhotoSharedInteraction'] as string ?? '',
          diaryTotalWords: userData['diaryTotalWords'] as number ?? 0,
          diaryLastInteraction: userData['diaryLastInteraction'] as string ?? '',
          diaryEntryCount: userData['diaryEntryCount'] as number ?? 0,
        });
      });
      const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
      return { users, lastVisible };
    }));
  }
}

