// user-data.service.ts

import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, getFirestore } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class UserDataService {
  private db = getFirestore();
  private firestore = getFirestore(); // Puoi usare solo uno dei due, sono la stessa istanza
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

      // *** MODIFICA QUI PER nicknameLowercase ***
      if (dataToSave.nickname) {
        dataToSave.nicknameLowercase = dataToSave.nickname.toLowerCase().trim();
      } else {
        // Se nickname non è presente, imposta nicknameLowercase a una stringa vuota
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
  // user-data.service.ts (dal codice che mi hai fornito all'inizio)
  async searchUsers(searchTerm: string): Promise<any[]> {
    const normalizedSearchTerm = searchTerm.toLowerCase().trim();
    if (!normalizedSearchTerm) {
      return [];
    }

    const usersRef = collection(this.db, 'users');
    const allResults: any[] = [];
    const addedUids = new Set<string>();

    // Query per nickname
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

    // Query per nome
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

    allResults.sort((a, b) => a.nickname.localeCompare(b.nickname)); // Ordina per nickname
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


  //-----------------------------------------
  // METODO AGGIORNATO QUI per garantire tipi stringa e campi corretti
  async getUserDataById(userId: string): Promise<any | null> {
    if (!userId) {
      console.warn("ID utente non fornito per getUserDataById.");
      return null;
    }

    const userDocRef = doc(this.firestore, 'users', userId);
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Restituisci TUTTI i dati del documento Firestore
        // E in più aggiungi i campi mappati per compatibilità dove li usi già (es. chat-list)
        return {
          uid: docSnap.id,
          // Campi originali dal database:
          nickname: data['nickname'] || 'N/A', // Assicurati che siano stringhe
          name: data['name'] || 'N/A',
          photo: data['photo'] || 'assets/immaginiGenerali/default-avatar.jpg',
          banner: data['banner'] || 'assets/immaginiGenerali/default-banner.jpg', // Aggiunto banner
          bio: data['bio'] || 'N/A',
          email: data['email'] || 'N/A', // Aggiunto email
          lastLogin: data['lastLogin'] || 'N/A', // Aggiunto lastLogin se vuoi visualizzarlo
          nicknameLowercase: data['nicknameLowercase'] || '', // Mantenuti per la ricerca
          nameLowercase: data['nameLowercase'] || '', // Mantenuti per la ricerca

          // Campi mappati per compatibilità con altre parti dell'app (es. ChatListPage)
          username: data['nickname'] || data['name'] || 'Utente Senza Nome',
          displayName: data['name'] || data['nickname'] || 'Utente Senza Nome',
          profilePhotoUrl: data['photo'] || 'assets/immaginiGenerali/default-avatar.jpg',
        };
      } else {
        console.log("Nessun documento utente trovato in Firestore per l'UID:", userId);
        return null;
      }
    } catch (error) {
      console.error("Errore nel recupero dei dati utente per ID:", userId, error);
      return null;
    }
  }
}
