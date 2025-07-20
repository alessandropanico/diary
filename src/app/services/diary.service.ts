import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, getDoc, query, where, getDocs, orderBy, limit } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { User } from 'firebase/auth'; // Importa User se non è già nel tuo global

// Interfaccia per la voce del diario
// È importante che questa interfaccia sia coerente in tutti i servizi e componenti che la usano.
export interface DailyEntry {
  date: string; // Formato YYYY-MM-DD (chiave del documento)
  mood: string;
  note: string;
  energyLevel?: number; // Scala da 0 a 5
  sleepQuality?: 'scarso' | 'medio' | 'ottimo' | ''; // Qualità del sonno
  stressLevel?: number; // Scala da 0 a 5
  focusHours?: number; // Ore di focus
  timestamp?: number; // Timestamp di creazione/ultimo aggiornamento (per ordinamento)
}

@Injectable({
  providedIn: 'root'
})
export class DiaryService {

  constructor(private firestore: Firestore) { }

  /**
   * Salva una voce del diario per un utente specifico in una data specifica.
   * Se la voce esiste già, viene aggiornata; altrimenti, viene creata.
   * @param userId L'ID dell'utente autenticato.
   * @param entry La DailyEntry da salvare. La 'date' sarà usata come ID del documento.
   * @returns Un Observable<void> che indica il completamento dell'operazione.
   */
  saveDailyEntry(userId: string, entry: DailyEntry): Observable<void> {
    if (!userId || !entry || !entry.date) {
      console.error('DiaryService: ID utente o data della voce mancanti per il salvataggio.');
      return of(undefined); // Ritorna un observable che emette undefined per indicare un'operazione non valida
    }

    const entryRef = doc(this.firestore, `users/${userId}/diary/${entry.date}`);

    // Assicurati che il timestamp sia aggiornato ad ogni salvataggio
    const entryToSave: DailyEntry = {
      ...entry,
      timestamp: Date.now() // Aggiorna il timestamp all'ora corrente
    };

    return from(setDoc(entryRef, entryToSave, { merge: true })).pipe(
      catchError(error => {
        console.error('DiaryService: Errore durante il salvataggio della voce del diario:', error);
        throw error; // Rilancia l'errore per essere gestito dal chiamante
      })
    );
  }

  /**
   * Recupera una voce del diario per un utente specifico e una data specifica.
   * @param userId L'ID dell'utente autenticato.
   * @param date La data della voce del diario nel formato YYYY-MM-DD.
   * @returns Un Observable<DailyEntry | undefined> che emette la voce del diario, o undefined se non trovata o in caso di errore.
   */
  getDailyEntry(userId: string, date: string): Observable<DailyEntry | undefined> {
    if (!userId || !date) {
      console.warn('DiaryService: ID utente o data mancanti per il recupero.');
      return of(undefined);
    }

    const entryRef = doc(this.firestore, `users/${userId}/diary/${date}`);
    return from(getDoc(entryRef)).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          return snapshot.data() as DailyEntry;
        } else {
          // console.log(`DiaryService: Nessuna voce trovata per la data ${date}`);
          return undefined;
        }
      }),
      catchError(error => {
        console.error('DiaryService: Errore durante il recupero della voce del diario:', error);
        throw error;
      })
    );
  }

  /**
   * Recupera le ultime N voci del diario per un utente specifico.
   * Utile per la sezione "Accesso Archivi" o per un riassunto recente.
   * @param userId L'ID dell'utente autenticato.
   * @param numEntries Il numero massimo di voci da recuperare (es. 7 per l'ultima settimana).
   * @returns Un Observable<DailyEntry[]> che emette un array di voci del diario.
   */
  getRecentDailyEntries(userId: string, numEntries: number = 7): Observable<DailyEntry[]> {
    if (!userId) {
      console.warn('DiaryService: ID utente mancante per recupero voci recenti.');
      return of([]);
    }

    const diaryCollectionRef = collection(this.firestore, `users/${userId}/diary`);
    const q = query(diaryCollectionRef, orderBy('timestamp', 'desc'), limit(numEntries));

    return from(getDocs(q)).pipe(
      map(snapshot => {
        const entries: DailyEntry[] = [];
        snapshot.forEach(doc => {
          entries.push(doc.data() as DailyEntry);
        });
        return entries;
      }),
      catchError(error => {
        console.error('DiaryService: Errore durante il recupero delle voci recenti:', error);
        throw error;
      })
    );
  }
}
