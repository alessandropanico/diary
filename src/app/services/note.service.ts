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
        this.userDataService.setIncompleteListItems(0);
        this.userDataService.setTotalListsCount(playlists.length - 1);
        // ⭐ AGGIORNAMENTO ULTIMA ATTIVITÀ GLOBALE - Al caricamento iniziale se ci sono playlist
        if (playlists.length > 1) { // Più di 1 perché "Tutti" è sempre presente
          this.userDataService.setLastGlobalActivityTimestamp(new Date().toISOString()) // Usa setLastGlobalActivityTimestamp
            .catch(e => console.error("Errore nell'aggiornamento lastGlobalActivityTimestamp da playlist load", e));
        }
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
        this.userDataService.setTotalNotesCount(notes.length);
        // ⭐ AGGIORNAMENTO ULTIMA ATTIVITÀ GLOBALE - Al caricamento iniziale se ci sono note
        if (notes.length > 0) {
          this.userDataService.setLastGlobalActivityTimestamp(new Date().toISOString()) // Usa setLastGlobalActivityTimestamp
            .catch(e => console.error("Errore nell'aggiornamento lastGlobalActivityTimestamp da note load", e));
        }
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

  addNote(note: Note): Observable<void> {
    if (!this.userId) return of(console.error('Non autorizzato: utente non loggato per addNote.'));
    // Controlla se note.id esiste prima di usarlo per il docRef
    if (!note.id) {
      console.error('Errore: ID nota mancante per addNote. Generazione di un nuovo ID.');
      // Genera un ID se mancante, è buona pratica se non lo fai a monte
      note.id = doc(collection(this.firestore, `users/${this.userId}/notes`)).id;
    }

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
        this.expService.addExperience(5);
        console.log('[NoteService] XP aggiunti per nuova nota.');
        this.userDataService.incrementTotalNotesCount();
        this.userDataService.setLastNoteListInteraction(new Date().toISOString());
        // ⭐ NUOVO: Aggiorna il timestamp specifico per l'ultima interazione con le note
        this.userDataService.setLastNoteInteraction(new Date().toISOString())
          .catch(e => console.error("Errore nell'aggiornamento lastNoteInteraction da addNote", e));

        // ⭐ AGGIORNAMENTO ULTIMA ATTIVITÀ GLOBALE (già presente, ma riaffermiamo)
        this.userDataService.setLastGlobalActivityTimestamp(new Date().toISOString()) // Usa setLastGlobalActivityTimestamp
          .catch(e => console.error("Errore nell'aggiornamento lastGlobalActivityTimestamp da addNote", e));
      }),
      catchError(error => {
        console.error('Errore nell\'aggiunta della nota a Firestore:', error);
        throw error;
      })
    );
  }

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
        this.userDataService.setLastNoteListInteraction(new Date().toISOString());
        // ⭐ NUOVO: Aggiorna il timestamp specifico per l'ultima interazione con le note
        this.userDataService.setLastNoteInteraction(new Date().toISOString())
          .catch(e => console.error("Errore nell'aggiornamento lastNoteInteraction da updateNote", e));

        // ⭐ AGGIORNAMENTO ULTIMA ATTIVITÀ GLOBALE (già presente, ma riaffermiamo)
        this.userDataService.setLastGlobalActivityTimestamp(new Date().toISOString()) // Usa setLastGlobalActivityTimestamp
          .catch(e => console.error("Errore nell'aggiornamento lastGlobalActivityTimestamp da updateNote", e));
      }),
      catchError(error => {
        console.error('Errore nell\'aggiornamento della nota in Firestore:', error);
        throw error;
      })
    );
  }


  deleteNote(id: string): Observable<void> {
    if (!this.userId || !id) {
      return of(console.error('Non autorizzato o ID nota mancante per eliminazione.'));
    }
    const noteRef = doc(this.firestore, `users/${this.userId}/notes/${id}`);

    return from(deleteDoc(noteRef)).pipe(
      tap(() => {
        console.log('Nota eliminata da Firestore:', id);
        this.userDataService.incrementTotalNotesCount(-1);
        this.userDataService.setLastNoteListInteraction(new Date().toISOString());
        // ⭐ NUOVO: Aggiorna il timestamp specifico per l'ultima interazione con le note
        this.userDataService.setLastNoteInteraction(new Date().toISOString())
          .catch(e => console.error("Errore nell'aggiornamento lastNoteInteraction da deleteNote", e));

        // ⭐ AGGIORNAMENTO ULTIMA ATTIVITÀ GLOBALE (già presente, ma riaffermiamo)
        this.userDataService.setLastGlobalActivityTimestamp(new Date().toISOString()) // Usa setLastGlobalActivityTimestamp
          .catch(e => console.error("Errore nell'aggiornamento lastGlobalActivityTimestamp da deleteNote", e));
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

  addPlaylist(name: string): Observable<void> {
    if (!this.userId) return of(console.error('Non autorizzato: utente non loggato per addPlaylist.'));

    const playlistCollectionRef = collection(this.firestore, `users/${this.userId}/notePlaylists`);
    const newDocRef = doc(playlistCollectionRef);
    const newPlaylist: Playlist = { id: newDocRef.id, name };

    return from(setDoc(newDocRef, newPlaylist)).pipe(
      tap(() => {
        console.log('Playlist aggiunta a Firestore:', newPlaylist);
        this.expService.addExperience(10);
        console.log('[NoteService] XP aggiunti per nuova playlist.');
        this.userDataService.incrementTotalListsCount();
        this.userDataService.setLastNoteListInteraction(new Date().toISOString());
        // ⭐ AGGIORNAMENTO ULTIMA ATTIVITÀ GLOBALE
        this.userDataService.saveUserData({ lastGlobalActivityTimestamp: new Date().toISOString() })
          .catch(e => console.error("Errore nell'aggiornamento lastGlobalActivityTimestamp da addPlaylist", e));
      }),
      catchError(error => {
        console.error('Errore nell\'aggiunta della playlist a Firestore:', error);
        throw error;
      })
    );
  }

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
            this.userDataService.incrementTotalListsCount(-1);
            if (deletedNotesCount > 0) {
              this.userDataService.incrementTotalNotesCount(-deletedNotesCount);
            }
            this.userDataService.setLastNoteListInteraction(new Date().toISOString());
            // ⭐ AGGIORNAMENTO ULTIMA ATTIVITÀ GLOBALE
            this.userDataService.saveUserData({ lastGlobalActivityTimestamp: new Date().toISOString() })
              .catch(e => console.error("Errore nell'aggiornamento lastGlobalActivityTimestamp da deletePlaylist", e));
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
