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

import { Note } from '../interfaces/note'; // L'interfaccia che mi hai fornito
import { Playlist } from '../interfaces/playlist';

import { ExpService } from './exp.service';
import { UserDataService } from './user-data.service';

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
    private auth: Auth,
    private expService: ExpService,
    private userDataService: UserDataService
  ) {
    this._isLoading.next(true);

    user(this.auth).subscribe(firebaseUser => {
      this.userId = firebaseUser ? firebaseUser.uid : null;
      if (this.userId) {
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

    const playlistsCollection = collection(this.firestore, `users/${this.userId}/notePlaylists`);
    collectionData(playlistsCollection, { idField: 'id' }).pipe(
      map(playlists => {
        const typedPlaylists = playlists as Playlist[];
        const allPlaylist: Playlist = { id: 'all', name: 'Tutti' };
        return [allPlaylist, ...typedPlaylists.sort((a, b) => a.name.localeCompare(b.name))];
      }),
      tap(playlists => {
        this._playlistsSubject.next(playlists);
        // Potresti aggiornare totalListsCount qui dopo il caricamento iniziale
        this.userDataService.setIncompleteListItems(0); // Le note non sono task in questa versione
        this.userDataService.setTotalListsCount(playlists.length - 1); // -1 per escludere "Tutti"
      }),
      catchError(error => {
        console.error('Errore nel caricamento delle playlist da Firestore:', error);
        return of([{ id: 'all', name: 'Tutti' }]);
      })
    ).subscribe();

    const notesCollection = collection(this.firestore, `users/${this.userId}/notes`);
    collectionData(notesCollection, { idField: 'id' }).pipe(
      map(notes => notes as Note[]),
      tap(notes => {
        this._notesSubject.next(notes);
        this._isLoading.next(false);
        // Aggiorna totalNotesCount dopo il caricamento iniziale
        this.userDataService.setTotalNotesCount(notes.length);
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
   * Aggiunge una nuova nota a Firestore e aggiunge XP.
   * @param note La nota da aggiungere. L'ID dovrebbe essere generato dal client (es. uuidv4()).
   * @returns Un Observable<void> che si completa quando l'operazione è finita.
   */
  addNote(note: Note): Observable<void> {
    if (!this.userId) return of(console.error('Non autorizzato: utente non loggato per addNote.'));
    if (!note.id) return of(console.error('Errore: ID nota mancante per addNote.'));

    const playlistIdToSave = note.playlistId === 'all' ? null : note.playlistId;

    const noteRef = doc(this.firestore, `users/${this.userId}/notes/${note.id}`);
    const newNote: Note = {
      ...note,
      playlistId: playlistIdToSave,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any
    };

    return from(setDoc(noteRef, newNote)).pipe(
      tap(() => {
        console.log('Nota aggiunta a Firestore:', newNote.id);
        // Aggiungi XP per la creazione di una nota
        this.expService.addExperience(5); // Esempio: 5 XP per ogni nuova nota
        console.log('[NoteService] XP aggiunti per nuova nota.');
        // Aggiorna il contatore totale delle note
        this.userDataService.incrementTotalNotesCount();
        this.userDataService.setLastNoteListInteraction(new Date().toISOString());
      }),
      catchError(error => {
        console.error('Errore nell\'aggiunta della nota a Firestore:', error);
        throw error;
      })
    );
  }

  /**
   * Aggiorna una nota esistente in Firestore. Nessun XP per l'aggiornamento.
   * @param updatedNote La nota con i dati aggiornati.
   * @returns Un Observable<void> che si completa quando l'operazione è finita.
   */
  updateNote(updatedNote: Note): Observable<void> {
    if (!this.userId || !updatedNote.id) {
      return of(console.error('Non autorizzato o ID nota mancante per aggiornamento.'));
    }

    const playlistIdToSave = updatedNote.playlistId === 'all' ? null : updatedNote.playlistId;

    const noteRef = doc(this.firestore, `users/${this.userId}/notes/${updatedNote.id}`);
    const noteToUpdate: Partial<Note> = {
      ...updatedNote,
      playlistId: playlistIdToSave,
      updatedAt: serverTimestamp() as any
    };

    return from(updateDoc(noteRef, noteToUpdate)).pipe(
      tap(() => {
        console.log('Nota aggiornata in Firestore:', updatedNote.id);
        // Nessuna logica XP per il completamento task se i campi non esistono
        this.userDataService.setLastNoteListInteraction(new Date().toISOString());
      }),
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
      tap(() => {
        console.log('Nota eliminata da Firestore:', id);
        // Aggiorna il contatore totale delle note
        this.userDataService.incrementTotalNotesCount(-1); // Decrementa
        this.userDataService.setLastNoteListInteraction(new Date().toISOString());
      }),
      catchError(error => {
        console.error('Errore nell\'eliminazione della nota da Firestore:', error);
        throw error;
      })
    );
  }

  getPlaylistsSnapshot(): Playlist[] {
    return this._playlistsSubject.getValue();
  }

  /**
   * Aggiunge una nuova playlist a Firestore e aggiunge XP.
   * @param name Il nome della playlist.
   * @returns Un Observable<void> che si completa.
   */
  addPlaylist(name: string): Observable<void> {
    if (!this.userId) return of(console.error('Non autorizzato: utente non loggato per addPlaylist.'));

    const playlistCollectionRef = collection(this.firestore, `users/${this.userId}/notePlaylists`);
    const newDocRef = doc(playlistCollectionRef);
    const newPlaylist: Playlist = { id: newDocRef.id, name };

    return from(setDoc(newDocRef, newPlaylist)).pipe(
      tap(() => {
        console.log('Playlist aggiunta a Firestore:', newPlaylist);
        // Aggiungi XP per la creazione di una playlist
        this.expService.addExperience(10); // Esempio: 10 XP per ogni nuova playlist
        console.log('[NoteService] XP aggiunti per nuova playlist.');
        // Aggiorna il contatore totale delle liste
        this.userDataService.incrementTotalListsCount();
        this.userDataService.setLastNoteListInteraction(new Date().toISOString());
      }),
      catchError(error => {
        console.error('Errore nell\'aggiunta della playlist a Firestore:', error);
        throw error;
      })
    );
  }

  /**
   * Elimina una playlist e tutte le note ad essa associate.
   * NON permette di eliminare la playlist "Tutti". Aggiorna anche i contatori.
   * @param playlistId L'ID della playlist da eliminare.
   * @returns Un Observable<void> che si completa.
   */
  deletePlaylist(playlistId: string): Observable<void> {
    if (!this.userId || !playlistId || playlistId === 'all') {
      return of(console.error('Non autorizzato o ID playlist non valido (non puoi eliminare "Tutti").'));
    }

    const playlistRef = doc(this.firestore, `users/${this.userId}/notePlaylists/${playlistId}`);
    const notesCollectionRef = collection(this.firestore, `users/${this.userId}/notes`);
    const q = query(notesCollectionRef, where('playlistId', '==', playlistId));

    const batch = writeBatch(this.firestore);

    return from(getDocs(q)).pipe(
      switchMap(snapshot => {
        const deletedNotesCount = snapshot.size;

        snapshot.forEach(noteDoc => {
          batch.delete(noteDoc.ref);
        });

        batch.delete(playlistRef);

        return from(batch.commit()).pipe(
          tap(() => {
            console.log(`Playlist "${playlistId}" e ${deletedNotesCount} note associate eliminate da Firestore.`);
            this.userDataService.incrementTotalListsCount(-1); // Decrementa
            if (deletedNotesCount > 0) {
                 this.userDataService.incrementTotalNotesCount(-deletedNotesCount); // Decrementa il totale delle note
            }
            this.userDataService.setLastNoteListInteraction(new Date().toISOString());
          }),
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
    } catch (error) {
      console.error('Errore accesso anonimo:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
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
