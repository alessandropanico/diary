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
  selectedPlaylistId = 'all';
  notes: Note[] = [];
  filteredNotes: Note[] = [];

  constructor(private noteService: NoteService) { }

  ngOnInit() {
    this.loadPlaylists();
    this.loadNotes();
  }

  loadPlaylists() {
    this.playlists = this.noteService.getPlaylists();
  }

  loadNotes() {
    this.notes = this.noteService.getNotesByPlaylist(this.selectedPlaylistId);
  }

  selectPlaylist(id: string) {
    this.selectedPlaylistId = id;
    this.loadNotes();
  }

  openCreatePlaylist() {
    const name = prompt('Nome nuova playlist');
    if (name?.trim()) {
      this.noteService.addPlaylist(name.trim());
      this.loadPlaylists();
    }
  }

  openNewNoteModal() {
    const title = prompt('Titolo nota');
    const content = prompt('Contenuto nota');
    if (title?.trim() && content?.trim()) {
      const newNote: Note = {
        id: Date.now().toString(),
        title: title.trim(),
        content: content.trim(),
        playlistId: this.selectedPlaylistId,
        createdAt: Date.now() // <--- numero, non stringa
      };
      this.noteService.addNote(newNote);
      this.loadNotes();
    }
  }
}
