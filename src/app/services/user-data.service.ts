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

  // async getUserData(): Promise<any> {
  //   const uid = this.getUserUid();
  //   if (!uid) return null;

  //   const docRef = doc(this.db, 'users', uid);
  //   const docSnap = await getDoc(docRef);
  //   return docSnap.exists() ? docSnap.data() : null;
  // }

  // async saveUserData(data: any) {
  //   const uid = this.getUserUid();
  //   if (!uid) return;

  //   const docRef = doc(this.db, 'users', uid);
  //   await setDoc(docRef, data, { merge: true });
  // }


// MOLTO IMPORTANTE: Salva sempre i campi in minuscolo per una ricerca efficiente!
  async saveUserData(data: any): Promise<void> {
    const user = this.auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'users', user.uid);

      // Clona i dati per evitare modifiche dirette all'oggetto originale
      const dataToSave = { ...data };

      // Genera e aggiungi i campi lowercase prima di salvare
      if (dataToSave.nickname) {
        dataToSave.nicknameLowercase = dataToSave.nickname.toLowerCase().trim();
      } else {
        dataToSave.nicknameLowercase = ''; // Assicurati che sia vuoto se il nickname non c'è
      }

      if (dataToSave.name) {
        dataToSave.nameLowercase = dataToSave.name.toLowerCase().trim();
      } else {
        dataToSave.nameLowercase = ''; // Assicurati che sia vuoto se il nome non c'è
      }

      try {
        await setDoc(userDocRef, dataToSave, { merge: true });
        console.log("Dati utente salvati con successo, inclusi i campi lowercase.");
      } catch (error) {
        console.error("Errore nel salvataggio dei dati utente:", error);
        throw error; // Rilancia l'errore per gestirlo nella pagina del profilo
      }
    } else {
      console.warn("Nessun utente loggato. Impossibile salvare i dati utente.");
      throw new Error("Utente non autenticato.");
    }
  }


  // NUOVO METODO AGGIORNATO: searchUsers per cercare per nickname O nome
  async searchUsers(searchTerm: string): Promise<any[]> {
    const normalizedSearchTerm = searchTerm.toLowerCase().trim();
    if (!normalizedSearchTerm) {
      return [];
    }

    const usersRef = collection(this.db, 'users');
    const allResults: any[] = [];
    const addedUids = new Set<string>(); // Per evitare duplicati

    // --- QUERY 1: Ricerca per nicknameLowercase ---
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

    // --- QUERY 2: Ricerca per nameLowercase ---
    const queryByName = query(
      usersRef,
      where('nameLowercase', '>=', normalizedSearchTerm),
      where('nameLowercase', '<=', normalizedSearchTerm + '\uf8ff'),
      orderBy('nameLowercase'), // Importante: devi ordinare sul campo che stai filtrando
      limit(10)
    );

    const snapshotName = await getDocs(queryByName);
    snapshotName.forEach((doc) => {
      const userData = doc.data();
      if (!addedUids.has(doc.id)) { // Aggiungi solo se non è già stato aggiunto
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

    // Ordina i risultati finali (opzionale, ma utile per coerenza)
    // Puoi scegliere un criterio di ordinamento, ad esempio per nickname
    allResults.sort((a, b) => a.nickname.localeCompare(b.nickname));

    return allResults;
  }

  // Metodo per recuperare i dati di un utente specifico per UID
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
          console.log("Nessun documento utente trovato in Firestore per l'UID:", user.uid);
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
}

