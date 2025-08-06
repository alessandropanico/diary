// src/app/services/presence.service.ts
import { Injectable } from '@angular/core';
import { getDatabase, ref, set, onDisconnect } from 'firebase/database';
import { getAuth } from 'firebase/auth';
// ⭐ Importa il tuo UserDataService
import { UserDataService } from './user-data.service';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { serverTimestamp } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class PresenceService {

  // ⭐ Inietta UserDataService e Firestore
  constructor(
    private userDataService: UserDataService,
    private firestore: Firestore
  ) { }

  async setPresence() {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      console.warn('Utente non autenticato. Impossibile impostare lo stato di presenza.');
      return;
    }

    const db = getDatabase();
    const userRef = ref(db, `presence/${user.uid}`);
    const now = new Date().toISOString();

    // 1. Dì a Realtime Database di impostare lo stato offline in caso di disconnessione
    await onDisconnect(userRef).set({ online: false, lastOnline: now });

    // 2. Imposta lo stato a online nel Realtime Database in tempo reale
    await set(userRef, { online: true, lastOnline: now });

    // ⭐ 3. Aggiorna anche il campo lastOnline in Firestore, per mantenerlo sincronizzato ⭐
    const userDocRef = doc(this.firestore, 'users', user.uid);
    try {
      await updateDoc(userDocRef, { lastOnline: serverTimestamp() });
    } catch (error) {
      console.error("Errore nell'aggiornamento del timestamp lastOnline in Firestore:", error);
    }

    console.log(`Stato di presenza impostato per l'utente ${user.uid}: ONLINE`);
  }
}
