import { Component, OnInit, OnDestroy } from '@angular/core';
import { NoteService } from 'src/app/services/note.service';
import { Note } from 'src/app/interfaces/note';
import { Playlist } from 'src/app/interfaces/playlist';
import { ModalController } from '@ionic/angular';
import { NoteEditorComponent } from './components/note-editor/note-editor.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-note',
  templateUrl: './note.page.html',
  styleUrls: ['./note.page.scss'],
  standalone: false,
})
export class NotePage implements OnInit, OnDestroy {

  playlists: Playlist[] = [];
  selectedPlaylistId: string = 'all';
  notes: Note[] = [];
  filteredNotes: Note[] = [];

  private subs: Subscription[] = [];

  constructor(
    private noteService: NoteService,
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {
    // Sottoscrizione reattiva
    this.subs.push(
      this.noteService.playlists$.subscribe(playlists => {
        this.playlists = playlists;
      })
    );

    this.subs.push(
      this.noteService.notes$.subscribe(notes => {
        this.notes = notes;
        this.filterNotes();
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
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
      // Non serve più loadPlaylists perché sottoscritto
    }
  }

  async openNewNoteModal() {
    const modal = await this.modalCtrl.create({
      component: NoteEditorComponent,
      componentProps: { playlistId: this.selectedPlaylistId },
      breakpoints: [0, 1],
      initialBreakpoint: 1
    });

    // Non serve più chiamare loadNotes, si aggiorna automaticamente
    await modal.present();
  }

  async openEditNoteModal(note: Note) {
    const modal = await this.modalCtrl.create({
      component: NoteEditorComponent,
      componentProps: { note: { ...note } },
      breakpoints: [0, 1],
      initialBreakpoint: 1
    });

    await modal.present();
  }

  async openNoteModal(note: Note) {
    const modal = await this.modalCtrl.create({
      component: NoteEditorComponent,
      componentProps: {
        playlistId: note.playlistId,
        note: note
      },
      breakpoints: [0, 1],
      initialBreakpoint: 1
    });

    await modal.present();
  }

  deleteSelectedPlaylist() {
    const selected = this.playlists.find(p => p.id === this.selectedPlaylistId);
    if (!selected || selected.id === 'all') {
      return; // Non dovrebbe mai entrare qui perché il bottone è disabilitato
    }

    const confirmed = confirm(`Sei sicuro di voler eliminare la playlist "${selected.name}"?`);
    if (confirmed) {
      this.noteService.deletePlaylist(selected.id);
      this.selectPlaylist('all');
    }
  }

}
