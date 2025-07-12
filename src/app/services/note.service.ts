import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';

import {
  Firestore,
  collection,
  collectionData,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp
} from '@angular/fire/firestore';

import { Auth, user, signInAnonymously, signOut } from '@angular/fire/auth';

import { Note } from '../interfaces/note';
import { Playlist } from '../interfaces/playlist';

@Injectable({
  providedIn: 'root'
})
export class NoteService {
  private _notesSubject = new BehaviorSubject<Note[]>([]);
  notes$: Observable<Note[]> = this._notesSubject.asObservable();

  private _playlistsSubject = new BehaviorSubject<Playlist[]>([]);
  playlists$: Observable<Playlist[]> = this._playlistsSubject.asObservable();

  private _isLoading = new BehaviorSubject<boolean>(true);
  isLoading$ = this._isLoading.asObservable();

  private userId: string | null = null;

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {
    this._isLoading.next(true);

    user(this.auth).subscribe(firebaseUser => {
      this.userId = firebaseUser ? firebaseUser.uid : null;
      if (this.userId) {
        console.log('NoteService: Utente autenticato con UID:', this.userId);
        this.initializeDataListeners();
      } else {
        console.warn('NoteService: Utente non autenticato. Tentativo di accesso anonimo.');
        this.signInAnonymously().then(() => {
        }).catch(error => {
          console.error('Errore nell\'accesso anonimo:', error);
          this._isLoading.next(false);
          this._notesSubject.next([]);
          this._playlistsSubject.next([]);
        });
      }
    });
  }

  private initializeDataListeners(): void {
    if (!this.userId) {
      console.error('initializeDataListeners: Nessun ID utente disponibile.');
      this._isLoading.next(false);
      return;
    }

    // Qui recuperiamo le playlist reali dall'utente
    const playlistsCollection = collection(this.firestore, `users/${this.userId}/notePlaylists`); // *** MODIFICATO: Usiamo 'notePlaylists'
    collectionData(playlistsCollection, { idField: 'id' }).pipe(
      map(playlists => {
        const typedPlaylists = playlists as Playlist[];
        const allPlaylist: Playlist = { id: 'all', name: 'Tutti' };

        // Aggiungiamo sempre "Tutti" e poi ordiniamo le altre playlist
        return [allPlaylist, ...typedPlaylists.sort((a, b) => a.name.localeCompare(b.name))];
      }),
      tap(playlists => {
        this._playlistsSubject.next(playlists);
        console.log('Playlists caricate:', playlists);
      }),
      catchError(error => {
        console.error('Errore nel caricamento delle playlist da Firestore:', error);
        // In caso di errore, garantiamo che "Tutti" sia comunque presente
        return of([{ id: 'all', name: 'Tutti' }]);
      })
    ).subscribe();

    // Qui recuperiamo le note dell'utente
    const notesCollection = collection(this.firestore, `users/${this.userId}/notes`);
    collectionData(notesCollection, { idField: 'id' }).pipe(
      map(notes => notes as Note[]),
      tap(notes => {
        this._notesSubject.next(notes);
        console.log('Note caricate:', notes);
        this._isLoading.next(false);
      }),
      catchError(error => {
        console.error('Errore nel caricamento delle note da Firestore:', error);
        this._isLoading.next(false);
        return of([]);
      })
    ).subscribe();
  }

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

    // Se la nota è associata a "Tutti" ('all'), salva null in Firestore
    const playlistIdToSave = note.playlistId === 'all' ? null : note.playlistId;

    const noteRef = doc(this.firestore, `users/${this.userId}/notes/${note.id}`);
    const newNote: Note = {
      ...note,
      playlistId: playlistIdToSave, // Usa il valore corretto per Firestore
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any
    };

    return from(setDoc(noteRef, newNote)).pipe(
      tap(() => console.log('Nota aggiunta a Firestore:', newNote.id)),
      catchError(error => {
        console.error('Errore nell\'aggiunta della nota a Firestore:', error);
        throw error;
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

    // Se la nota è associata a "Tutti" ('all'), salva null in Firestore
    const playlistIdToSave = updatedNote.playlistId === 'all' ? null : updatedNote.playlistId;

    const noteRef = doc(this.firestore, `users/${this.userId}/notes/${updatedNote.id}`);
    const noteToUpdate: Partial<Note> = {
      ...updatedNote,
      playlistId: playlistIdToSave, // Usa il valore corretto per Firestore
      updatedAt: serverTimestamp() as any
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

    // *** MODIFICATO: Usiamo 'notePlaylists'
    const playlistCollectionRef = collection(this.firestore, `users/${this.userId}/notePlaylists`);
    const newDocRef = doc(playlistCollectionRef);
    const newPlaylist: Playlist = { id: newDocRef.id, name };

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

    // *** MODIFICATO: Usiamo 'notePlaylists'
    const playlistRef = doc(this.firestore, `users/${this.userId}/notePlaylists/${playlistId}`);
    const notesCollectionRef = collection(this.firestore, `users/${this.userId}/notes`);
    const q = query(notesCollectionRef, where('playlistId', '==', playlistId));

    const batch = writeBatch(this.firestore);

    return from(getDocs(q)).pipe(
      switchMap(snapshot => {
        snapshot.forEach(noteDoc => {
          batch.delete(noteDoc.ref);
        });

        batch.delete(playlistRef);

        return from(batch.commit()).pipe(
          tap(() => console.log(`Playlist "${playlistId}" e ${snapshot.size} note associate eliminate da Firestore.`)),
          catchError(error => {
            console.error('Errore durante l\'eliminazione della playlist e delle note in Firestore:', error);
            throw error;
          })
        );
      })
    );
  }

  async signInAnonymously(): Promise<void> {
    try {
      const userCredential = await signInAnonymously(this.auth);
      console.log('Accesso anonimo riuscito:', userCredential.user.uid);
    } catch (error) {
      console.error('Errore accesso anonimo:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      console.log('Logout effettuato.');
      this.userId = null;
      this._notesSubject.next([]);
      this._playlistsSubject.next([]);
      this._isLoading.next(false);
    } catch (error) {
      console.error('Errore durante il logout:', error);
      throw error;
    }
  }

  getCurrentUserObservable(): Observable<any> {
    return user(this.auth);
  }
}
