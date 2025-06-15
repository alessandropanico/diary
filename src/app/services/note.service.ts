import { Injectable } from '@angular/core';
import { Note } from '../interfaces/note';
import { Playlist } from '../interfaces/playlist';


@Injectable({
  providedIn: 'root'
})
export class NoteService {
  private PLAYLIST_STORAGE_KEY = 'notePlaylists';
  private NOTES_STORAGE_KEY = 'notes';

  constructor() { }

  getPlaylists(): Playlist[] {
    const data = localStorage.getItem(this.PLAYLIST_STORAGE_KEY);
    if (data) return JSON.parse(data);
    // Se non ci sono playlist, creiamo la playlist "Tutti" di default
    const defaultPlaylist = [{ id: 'all', name: 'Tutti' }];
    localStorage.setItem(this.PLAYLIST_STORAGE_KEY, JSON.stringify(defaultPlaylist));
    return defaultPlaylist;
  }

  addPlaylist(name: string) {
    const playlists = this.getPlaylists();
    const newPlaylist = { id: this.generateId(), name };
    playlists.push(newPlaylist);
    localStorage.setItem(this.PLAYLIST_STORAGE_KEY, JSON.stringify(playlists));
  }

  deletePlaylist(id: string) {
    let playlists = this.getPlaylists();
    playlists = playlists.filter(pl => pl.id !== id);
    localStorage.setItem(this.PLAYLIST_STORAGE_KEY, JSON.stringify(playlists));
    // Eliminiamo anche le note associate
    let notes = this.getNotes();
    notes = notes.filter(note => note.playlistId !== id);
    localStorage.setItem(this.NOTES_STORAGE_KEY, JSON.stringify(notes));
  }

  getNotes(): Note[] {
    const data = localStorage.getItem(this.NOTES_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  getNotesByPlaylist(playlistId: string): Note[] {
    return this.getNotes().filter(note => note.playlistId === playlistId);
  }

  addNote(playlistId: string, content: string) {
    const notes = this.getNotes();
    const newNote = {
      id: this.generateId(),
      playlistId,
      content,
      createdAt: new Date().toISOString()
    };
    notes.push(newNote);
    localStorage.setItem(this.NOTES_STORAGE_KEY, JSON.stringify(notes));
  }

  updateNote(noteId: string, content: string) {
    const notes = this.getNotes();
    const note = notes.find(n => n.id === noteId);
    if (note) {
      note.content = content;
      localStorage.setItem(this.NOTES_STORAGE_KEY, JSON.stringify(notes));
    }
  }

  deleteNote(noteId: string) {
    let notes = this.getNotes();
    notes = notes.filter(n => n.id !== noteId);
    localStorage.setItem(this.NOTES_STORAGE_KEY, JSON.stringify(notes));
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
