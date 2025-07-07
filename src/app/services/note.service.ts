import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs'; // from e of per convertire Promise in Observable
import { map, tap, catchError, switchMap } from 'rxjs/operators'; // Operatori RxJS

// Importa i moduli di Firebase necessari
import {
  Firestore,
  collection,
  collectionData, // Per ottenere Observable da collezioni
  doc,
  setDoc,      // Per creare/sovrascrivere un documento
  updateDoc,   // Per aggiornare un documento
  deleteDoc,   // Per eliminare un documento
  query,       // Per creare query complesse
  where,       // Per filtri nelle query
  getDocs,     // Per ottenere snapshot una tantum
  writeBatch,  // Per operazioni multiple atomiche
  serverTimestamp // Per timestamp generati dal server
} from '@angular/fire/firestore';

import { Auth, user, signInAnonymously, signOut } from '@angular/fire/auth'; // Per l'autenticazione

// Le tue interfacce esistenti
import { Note } from '../interfaces/note';
import { Playlist } from '../interfaces/playlist';

@Injectable({
  providedIn: 'root'
})
export class NoteService {
  // BehaviorSubject per le note e le playlist (ora caricate da Firestore)
  private _notesSubject = new BehaviorSubject<Note[]>([]);
  notes$: Observable<Note[]> = this._notesSubject.asObservable();

  private _playlistsSubject = new BehaviorSubject<Playlist[]>([]);
  playlists$: Observable<Playlist[]> = this._playlistsSubject.asObservable();

  private _isLoading = new BehaviorSubject<boolean>(true); // Per lo stato di caricamento iniziale
  isLoading$ = this._isLoading.asObservable();

  private userId: string | null = null; // ID dell'utente Firebase corrente

  constructor(
    private firestore: Firestore, // Inietta il servizio Firestore
    private auth: Auth           // Inietta il servizio Auth
  ) {
    this._isLoading.next(true); // Imposta isLoading a true all'inizio

    // Sottoscriviti allo stato dell'utente per caricare i dati
    // `user(this.auth)` fornisce un Observable dell'utente autenticato
    user(this.auth).subscribe(firebaseUser => {
      this.userId = firebaseUser ? firebaseUser.uid : null;
      if (this.userId) {
        console.log('NoteService: Utente autenticato con UID:', this.userId);
        this.initializeDataListeners(); // Avvia l'ascolto dei dati Firebase
      } else {
        console.warn('NoteService: Utente non autenticato. Tentativo di accesso anonimo.');
        // Se non c'è utente, prova ad accedere in modo anonimo
        this.signInAnonymously().then(() => {
          // Dopo l'accesso, l'Observable `user(this.auth)` emetterà un nuovo utente,
          // e questo subscribe si attiverà di nuovo con il userId.
        }).catch(error => {
          console.error('Errore nell\'accesso anonimo:', error);
          this._isLoading.next(false); // Ferma il caricamento in caso di errore critico
          this._notesSubject.next([]);
          this._playlistsSubject.next([]);
        });
      }
    });
  }

  /**
   * Avvia gli ascoltatori delle collezioni Firestore per note e playlist.
   * Viene chiamato solo quando l'utente è autenticato.
   */
  private initializeDataListeners(): void {
    if (!this.userId) {
      console.error('initializeDataListeners: Nessun ID utente disponibile.');
      this._isLoading.next(false);
      return;
    }

    // Listener per le Playlist
    const playlistsCollection = collection(this.firestore, `users/${this.userId}/playlists`);
    collectionData(playlistsCollection, { idField: 'id' }).pipe(
      map(playlists => {
        const typedPlaylists = playlists as Playlist[];
        // Assicurati che la playlist "Tutti" esista e sia la prima.
        // Se non esiste nel DB, la aggiungiamo solo in memoria per la UI.
        const allPlaylistExists = typedPlaylists.some(p => p.id === 'all' && p.name === 'Tutti');
        if (!allPlaylistExists) {
          // Qui potresti anche decidere di aggiungerla esplicitamente a Firestore
          // this.addPlaylist({ id: 'all', name: 'Tutti' }); // se vuoi che sia persistente nel DB per ogni utente
          return [{ id: 'all', name: 'Tutti' }, ...typedPlaylists];
        }
        // Ordina in modo che "Tutti" sia sempre la prima nella lista
        return typedPlaylists.sort((a, b) => {
          if (a.id === 'all') return -1;
          if (b.id === 'all') return 1;
          return 0;
        });
      }),
      tap(playlists => {
        this._playlistsSubject.next(playlists);
        console.log('Playlists caricate:', playlists);
      }),
      catchError(error => {
        console.error('Errore nel caricamento delle playlist da Firestore:', error);
        return of([]); // In caso di errore, emetti un array vuoto
      })
    ).subscribe(); // Non dimenticare di sottoscrivere l'Observable!

    // Listener per le Note
    const notesCollection = collection(this.firestore, `users/${this.userId}/notes`);
    collectionData(notesCollection, { idField: 'id' }).pipe(
      map(notes => notes as Note[]),
      tap(notes => {
        this._notesSubject.next(notes);
        console.log('Note caricate:', notes);
        this._isLoading.next(false); // Imposta isLoading a false dopo che le note sono caricate
      }),
      catchError(error => {
        console.error('Errore nel caricamento delle note da Firestore:', error);
        this._isLoading.next(false);
        return of([]);
      })
    ).subscribe(); // Non dimenticare di sottoscrivere l'Observable!
  }


  /**
   * Restituisce un'istantanea corrente delle note.
   * Usato per operazioni "una tantum" che non richiedono reattività.
   */
  getNotesSnapshot(): Note[] {
    return this._notesSubject.getValue();
  }

  /**
   * Aggiunge una nuova nota a Firestore.
   * @param note La nota da aggiungere. L'ID dovrebbe essere generato dal client (es. uuidv4()).
   * @returns Un Observable<void> che si completa quando l'operazione è finita.
   */
  addNote(note: Note): Observable<void> {
    if (!this.userId) return of(console.error('Non autorizzato: utente non loggato per addNote.'));
    if (!note.id) return of(console.error('Errore: ID nota mancante per addNote.'));

    const noteRef = doc(this.firestore, `users/${this.userId}/notes/${note.id}`);
    const newNote: Note = {
      ...note,
      // Firebase serverTimestamp per createdAt e updatedAt
      createdAt: serverTimestamp() as any, // TypeScript lo vede come object, quindi cast a any
      updatedAt: serverTimestamp() as any
    };

    // Usiamo `from` per convertire la Promise di setDoc in un Observable
    return from(setDoc(noteRef, newNote)).pipe(
      tap(() => console.log('Nota aggiunta a Firestore:', newNote.id)),
      catchError(error => {
        console.error('Errore nell\'aggiunta della nota a Firestore:', error);
        throw error; // Rilancia l'errore
      })
    );
  }

  /**
   * Aggiorna una nota esistente in Firestore.
   * @param updatedNote La nota con i dati aggiornati.
   * @returns Un Observable<void> che si completa quando l'operazione è finita.
   */
  updateNote(updatedNote: Note): Observable<void> {
    if (!this.userId || !updatedNote.id) {
      return of(console.error('Non autorizzato o ID nota mancante per aggiornamento.'));
    }

    const noteRef = doc(this.firestore, `users/${this.userId}/notes/${updatedNote.id}`);
    const noteToUpdate: Partial<Note> = {
      ...updatedNote,
      updatedAt: serverTimestamp() as any // Aggiorna solo updatedAt
    };

    return from(updateDoc(noteRef, noteToUpdate)).pipe(
      tap(() => console.log('Nota aggiornata in Firestore:', updatedNote.id)),
      catchError(error => {
        console.error('Errore nell\'aggiornamento della nota in Firestore:', error);
        throw error;
      })
    );
  }

  /**
   * Elimina una nota da Firestore.
   * @param id L'ID della nota da eliminare.
   * @returns Un Observable<void> che si completa quando l'operazione è finita.
   */
  deleteNote(id: string): Observable<void> {
    if (!this.userId || !id) {
      return of(console.error('Non autorizzato o ID nota mancante per eliminazione.'));
    }
    const noteRef = doc(this.firestore, `users/${this.userId}/notes/${id}`);

    return from(deleteDoc(noteRef)).pipe(
      tap(() => console.log('Nota eliminata da Firestore:', id)),
      catchError(error => {
        console.error('Errore nell\'eliminazione della nota da Firestore:', error);
        throw error;
      })
    );
  }



  /**
   * Restituisce un'istantanea corrente delle playlist.
   * Utile per accedere ai dati immediatamente (es. per popolare un prompt radio).
   */
  getPlaylistsSnapshot(): Playlist[] {
    return this._playlistsSubject.getValue();
  }

  /**
   * Aggiunge una nuova playlist a Firestore.
   * Firestore genererà automaticamente l'ID per la nuova playlist.
   * @param name Il nome della playlist.
   * @returns Un Observable<void> che si completa.
   */
  addPlaylist(name: string): Observable<void> {
    if (!this.userId) return of(console.error('Non autorizzato: utente non loggato per addPlaylist.'));

    const playlistCollectionRef = collection(this.firestore, `users/${this.userId}/playlists`);
    const newDocRef = doc(playlistCollectionRef); // Firestore genera un ID automaticamente
    const newPlaylist: Playlist = { id: newDocRef.id, name }; // Assegna l'ID generato

    return from(setDoc(newDocRef, newPlaylist)).pipe(
      tap(() => console.log('Playlist aggiunta a Firestore:', newPlaylist)),
      catchError(error => {
        console.error('Errore nell\'aggiunta della playlist a Firestore:', error);
        throw error;
      })
    );
  }

  /**
   * Elimina una playlist e tutte le note ad essa associate.
   * NON permette di eliminare la playlist "Tutti".
   * @param playlistId L'ID della playlist da eliminare.
   * @returns Un Observable<void> che si completa.
   */
  deletePlaylist(playlistId: string): Observable<void> {
    if (!this.userId || !playlistId || playlistId === 'all') {
      return of(console.error('Non autorizzato o ID playlist non valido (non puoi eliminare "Tutti").'));
    }

    const playlistRef = doc(this.firestore, `users/${this.userId}/playlists/${playlistId}`);
    const notesCollectionRef = collection(this.firestore, `users/${this.userId}/notes`);
    const q = query(notesCollectionRef, where('playlistId', '==', playlistId));

    const batch = writeBatch(this.firestore); // Usa un batch per eliminazioni multiple atomiche

    // Prima, trova e aggiungi al batch le note da eliminare
    return from(getDocs(q)).pipe(
      switchMap(snapshot => {
        snapshot.forEach(noteDoc => {
          batch.delete(noteDoc.ref); // Aggiungi la nota al batch per l'eliminazione
        });

        batch.delete(playlistRef); // Aggiungi la playlist al batch per l'eliminazione

        return from(batch.commit()).pipe( // Esegui il batch
          tap(() => console.log(`Playlist "${playlistId}" e ${snapshot.size} note associate eliminate da Firestore.`)),
          catchError(error => {
            console.error('Errore durante l\'eliminazione della playlist e delle note in Firestore:', error);
            throw error;
          })
        );
      })
    );
  }


  /**
   * Effettua l'accesso anonimo a Firebase Auth.
   * Viene chiamato automaticamente dal servizio se non c'è un utente.
   */
  async signInAnonymously(): Promise<void> {
    try {
      const userCredential = await signInAnonymously(this.auth);
      console.log('Accesso anonimo riuscito:', userCredential.user.uid);
    } catch (error) {
      console.error('Errore accesso anonimo:', error);
      throw error;
    }
  }

  /**
   * Effettua il logout dell'utente corrente.
   * Resetta lo stato del servizio e i dati locali.
   */
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      console.log('Logout effettuato.');
      this.userId = null;
      this._notesSubject.next([]); // Svuota le note locali
      this._playlistsSubject.next([]); // Svuota le playlist locali
      this._isLoading.next(false);
    } catch (error) {
      console.error('Errore durante il logout:', error);
      throw error;
    }
  }

  /**
   * Restituisce l'Observable dell'utente Firebase Auth.
   */
  getCurrentUserObservable(): Observable<any> {
    return user(this.auth);
  }
}
