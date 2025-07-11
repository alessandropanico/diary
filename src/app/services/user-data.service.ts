import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, getFirestore } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class UserDataService {
  private db = getFirestore();
  private firestore = getFirestore();
  private auth = getAuth();

  private getUserUid(): string | null {
    const user = getAuth().currentUser;
    return user ? user.uid : null;
  }

  async saveUserData(data: any): Promise<void> {
    const user = this.auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'users', user.uid);
      const dataToSave = { ...data };

      if (dataToSave.nickname) {
        dataToSave.nicknameLowercase = dataToSave.nickname.toLowerCase().trim();
      } else {
        dataToSave.nicknameLowercase = '';
      }

      if (dataToSave.name) {
        dataToSave.nameLowercase = dataToSave.name.toLowerCase().trim();
      } else {
        dataToSave.nameLowercase = '';
      }

      try {
        await setDoc(userDocRef, dataToSave, { merge: true });
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
          return docSnap.data();
        } else {
          return null;
        }
      } catch (error) {
        console.error("Errore nel recupero dei dati utente:", error);
        return null;
      }
    } else {
      console.warn("Nessun utente loggato. Impossibile recuperare i dati utente.");
      return null;
    }
  }

 /**
   * Recupera i dati del profilo di un utente tramite il suo ID.
   * Restituisce una Promise<any | null>, coerentemente con gli altri tuoi metodi.
   * @param userId L'ID dell'utente.
   */
  async getUserDataById(uid: string): Promise<any | null> {
    if (!uid) {
      console.warn("UID utente non fornito per getUserDataById.");
      return null;
    }
    const userDocRef = doc(this.firestore, 'users', uid); // Usa this.firestore
    try {
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        // Aggiungi l'UID direttamente ai dati se non lo hai già nel tuo DB
        return { uid: userDocSnap.id, ...data };
      }
      return null; // Il documento non esiste
    } catch (error) {
      console.error("Errore nel recupero dati utente per UID:", uid, error);
      throw error; // Rilancia l'errore per gestirlo nel componente
    }
  }
}
