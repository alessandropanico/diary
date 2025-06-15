import { Component, OnInit } from '@angular/core';
import { NoteService } from 'src/app/services/note.service';
import { Note } from 'src/app/interfaces/note';
import { Playlist } from 'src/app/interfaces/playlist';
import { ModalController } from '@ionic/angular';
import { NoteEditorComponent } from './components/note-editor/note-editor.component';

@Component({
  selector: 'app-note',
  templateUrl: './note.page.html',
  styleUrls: ['./note.page.scss'],
  standalone: false,
})
export class NotePage implements OnInit {

  playlists: Playlist[] = [];
  selectedPlaylistId: string = 'all';
  notes: Note[] = [];
  filteredNotes: Note[] = [];

  constructor(
    private noteService: NoteService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.loadPlaylists();
    this.loadNotes();
  }

  loadPlaylists() {
    this.playlists = this.noteService.getPlaylists();
  }

  loadNotes() {
    this.notes = this.noteService.getNotes();
    this.filterNotes();
  }

  filterNotes() {
    if (this.selectedPlaylistId === 'all') {
      this.filteredNotes = this.notes;
    } else {
      this.filteredNotes = this.notes.filter(n => n.playlistId === this.selectedPlaylistId);
    }
  }

  selectPlaylist(id: string) {
    this.selectedPlaylistId = id;
    this.filterNotes();
  }

  openCreatePlaylist() {
    const name = prompt('Nome nuova playlist');
    if (name?.trim()) {
      this.noteService.addPlaylist(name.trim());
      this.loadPlaylists();
    }
  }

  async openNewNoteModal() {
    const modal = await this.modalCtrl.create({
      component: NoteEditorComponent,
      componentProps: { playlistId: this.selectedPlaylistId },
      breakpoints: [0, 1],
      initialBreakpoint: 1
    });

    modal.onDidDismiss().then(result => {
      if (result.role === 'save') {
        this.loadNotes();
      }
    });

    await modal.present();
  }
}
