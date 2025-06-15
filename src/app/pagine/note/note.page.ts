import { Component, OnInit } from '@angular/core';
import { NoteService } from 'src/app/services/note.service';
import { Note } from 'src/app/interfaces/note';
import { Playlist } from 'src/app/interfaces/playlist';


@Component({
  selector: 'app-note',
  templateUrl: './note.page.html',
  styleUrls: ['./note.page.scss'],
  standalone: false,
})
export class NotePage implements OnInit {

  playlists: Playlist[] = [];
  selectedPlaylistId: string = 'all'; // Default "Tutti"
  notes: Note[] = [];

  newPlaylistName: string = '';
  newNoteContent: string = '';

  editingNoteId: string | null = null;
  editingNoteContent: string = '';

  constructor(private noteService: NoteService) { }

  ngOnInit() {
    this.loadPlaylists();
    this.selectPlaylist(this.selectedPlaylistId);
  }

  get selectedPlaylistName(): string {
  const playlist = this.playlists.find(p => p.id === this.selectedPlaylistId);
  return playlist ? playlist.name : 'Tutti';
}


  loadPlaylists() {
    this.playlists = this.noteService.getPlaylists();
    if (!this.playlists.find(pl => pl.id === this.selectedPlaylistId)) {
      this.selectedPlaylistId = 'all';
    }
  }

  selectPlaylist(id: string) {
    this.selectedPlaylistId = id;
    if (id === 'all') {
      this.notes = this.noteService.getNotes(); // tutte le note
    } else {
      this.notes = this.noteService.getNotesByPlaylist(id);
    }
  }

  addPlaylist() {
    if (!this.newPlaylistName.trim()) return;
    this.noteService.addPlaylist(this.newPlaylistName.trim());
    this.newPlaylistName = '';
    this.loadPlaylists();
  }

  deletePlaylist(id: string) {
    if (id === 'all') return; // non cancellare "Tutti"
    this.noteService.deletePlaylist(id);
    this.loadPlaylists();
    this.selectPlaylist('all');
  }

  addNote() {
    if (!this.newNoteContent.trim()) return;
    this.noteService.addNote(this.selectedPlaylistId, this.newNoteContent.trim());
    this.newNoteContent = '';
    this.selectPlaylist(this.selectedPlaylistId); // ricarica note
  }

  editNote(note: Note) {
    this.editingNoteId = note.id;
    this.editingNoteContent = note.content;
  }

  saveNote() {
    if (!this.editingNoteContent.trim() || !this.editingNoteId) return;
    this.noteService.updateNote(this.editingNoteId, this.editingNoteContent.trim());
    this.editingNoteId = null;
    this.editingNoteContent = '';
    this.selectPlaylist(this.selectedPlaylistId);
  }

  cancelEdit() {
    this.editingNoteId = null;
    this.editingNoteContent = '';
  }

  deleteNote(noteId: string) {
    this.noteService.deleteNote(noteId);
    this.selectPlaylist(this.selectedPlaylistId);
  }
}
