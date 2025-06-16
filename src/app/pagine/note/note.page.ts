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

  isSelectionMode = false;
  selectedNoteIds: Set<string> = new Set();

  private subs: Subscription[] = [];

  constructor(
    private noteService: NoteService,
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {
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
    this.cancelSelectionMode();
  }

  openCreatePlaylist() {
    const name = prompt('Nome nuova playlist');
    if (name?.trim()) {
      this.noteService.addPlaylist(name.trim());
      // Aggiornamento automatico via sottoscrizione
    }
  }

  async openNewNoteModal() {
    const modal = await this.modalCtrl.create({
      component: NoteEditorComponent,
      componentProps: { playlistId: this.selectedPlaylistId },
      breakpoints: [0, 1],
      initialBreakpoint: 1
    });
    await modal.present();
  }

  async openNoteModal(note: Note) {
    if (this.isSelectionMode) {
      this.toggleNoteSelection(note);
      return;
    }

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

  onNoteClick(note: Note, event: MouseEvent) {
    if (this.isSelectionMode) {
      this.toggleNoteSelection(note);
    } else {
      this.openNoteModal(note);
    }
  }

  onNoteLongPress(note: Note) {
    this.isSelectionMode = true;
    this.selectedNoteIds.add(note.id);
  }

  onNoteRightClick(note: Note, event: MouseEvent) {
    event.preventDefault(); // evita il menu contestuale
    this.isSelectionMode = true;
    this.selectedNoteIds.add(note.id);
  }

  toggleNoteSelection(note: Note) {
    if (this.selectedNoteIds.has(note.id)) {
      this.selectedNoteIds.delete(note.id);
    } else {
      this.selectedNoteIds.add(note.id);
    }

    if (this.selectedNoteIds.size === 0) {
      this.cancelSelectionMode();
    }
  }

  deleteSelectedNotes() {
    this.selectedNoteIds.forEach(id => this.noteService.deleteNote(id));
    this.cancelSelectionMode();
  }

  cancelSelectionMode() {
    this.selectedNoteIds.clear();
    this.isSelectionMode = false;
  }

  onContentClick(event: MouseEvent) {
  if (!this.isSelectionMode) return;

  // Controlla che il click non sia su un elemento interattivo (checkbox, note, bottoni)
  const target = event.target as HTMLElement;

  // Se il click è dentro un checkbox o una nota, non annullare la selezione
  if (target.closest('ion-checkbox, .note-thumbnail, ion-button, ion-fab-button')) {
    return;
  }

  // Altrimenti annulla la modalità selezione
  this.cancelSelectionMode();
}


}
