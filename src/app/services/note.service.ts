import { Injectable } from '@angular/core';
import { Note } from '../interfaces/note';
import { Playlist } from '../interfaces/playlist';

@Injectable({
  providedIn: 'root'
})
export class NoteService {
  private NOTE_KEY = 'notes';
  private PLAYLIST_KEY = 'playlists';

  constructor() {
    if (!localStorage.getItem(this.PLAYLIST_KEY)) {
      this.savePlaylists([{ id: 'all', name: 'Tutti' }]);
    }
  }

  getPlaylists(): Playlist[] {
    return JSON.parse(localStorage.getItem(this.PLAYLIST_KEY) || '[]');
  }

  addPlaylist(name: string) {
    const playlists = this.getPlaylists();
    playlists.push({ id: Date.now().toString(), name });
    this.savePlaylists(playlists);
  }

  savePlaylists(playlists: Playlist[]) {
    localStorage.setItem(this.PLAYLIST_KEY, JSON.stringify(playlists));
  }

  getNotes(): Note[] {
    return JSON.parse(localStorage.getItem(this.NOTE_KEY) || '[]');
  }

  addNote(note: Note) {
    const notes = this.getNotes();
    notes.push(note);
    localStorage.setItem(this.NOTE_KEY, JSON.stringify(notes));
  }

  updateNote(note: Note) {
    const notes = this.getNotes();
    const index = notes.findIndex(n => n.id === note.id);
    if (index > -1) {
      notes[index] = note;
      localStorage.setItem(this.NOTE_KEY, JSON.stringify(notes));
    }
  }


}
