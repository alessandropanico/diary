import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Note } from '../interfaces/note';
import { Playlist } from '../interfaces/playlist';

@Injectable({
  providedIn: 'root'
})
export class NoteService {
  private NOTE_KEY = 'notes';
  private PLAYLIST_KEY = 'playlists';

  private notesSubject = new BehaviorSubject<Note[]>(this.getNotes());
  notes$ = this.notesSubject.asObservable();

  private playlistsSubject = new BehaviorSubject<Playlist[]>(this.getPlaylists());
  playlists$ = this.playlistsSubject.asObservable();

  constructor() {
    if (!localStorage.getItem(this.PLAYLIST_KEY)) {
      this.savePlaylists([{ id: 'all', name: 'Tutti' }]);
    }
    this.emitUpdates();
  }

  private emitUpdates() {
    this.notesSubject.next(this.getNotes());
    this.playlistsSubject.next(this.getPlaylists());
  }

  getPlaylists(): Playlist[] {
    return JSON.parse(localStorage.getItem(this.PLAYLIST_KEY) || '[]');
  }

  addPlaylist(name: string) {
    const playlists = this.getPlaylists();
    playlists.push({ id: Date.now().toString(), name });
    this.savePlaylists(playlists);
    this.playlistsSubject.next(playlists);
  }

  savePlaylists(playlists: Playlist[]) {
    localStorage.setItem(this.PLAYLIST_KEY, JSON.stringify(playlists));
    this.playlistsSubject.next(playlists);
  }

  getNotes(): Note[] {
    return JSON.parse(localStorage.getItem(this.NOTE_KEY) || '[]');
  }

  addNote(note: Note) {
    const notes = this.getNotes();
    notes.push(note);
    localStorage.setItem(this.NOTE_KEY, JSON.stringify(notes));
    this.notesSubject.next(notes);
  }

  updateNote(updatedNote: Note) {
    const notes = this.getNotes().map(n => n.id === updatedNote.id ? updatedNote : n);
    localStorage.setItem(this.NOTE_KEY, JSON.stringify(notes));
    this.notesSubject.next(notes);
  }

  deleteNote(id: string) {
    let notes = this.getNotes();
    notes = notes.filter(note => note.id !== id);
    localStorage.setItem(this.NOTE_KEY, JSON.stringify(notes));
    this.notesSubject.next(notes);
  }

  deletePlaylist(playlistId: string) {
  // Rimuovi la playlist
  let playlists = this.getPlaylists().filter(p => p.id !== playlistId);
  this.savePlaylists(playlists);

  // Elimina le note della playlist
  let notes = this.getNotes().filter(note => note.playlistId !== playlistId);
  localStorage.setItem(this.NOTE_KEY, JSON.stringify(notes));
  this.notesSubject.next(notes);
}



}
