import { Component, OnInit, OnDestroy } from '@angular/core';
import { NoteService } from 'src/app/services/note.service';
import { Note } from 'src/app/interfaces/note';
import { Playlist } from 'src/app/interfaces/playlist';
import { ModalController, AlertController } from '@ionic/angular';
import { NoteEditorComponent } from './components/note-editor/note-editor.component';
import { firstValueFrom, Subscription } from 'rxjs';

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
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
  ) { }

  ngOnInit() {
    this.subs.push(
      this.noteService.playlists$.subscribe(playlists => {
        this.playlists = playlists;
        if (!this.playlists.some(p => p.id === this.selectedPlaylistId)) {
          this.selectedPlaylistId = 'all';
          this.filterNotes();
        }
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

  async openCreatePlaylist() {
    const alert = await this.alertCtrl.create({
      header: 'Nuova Playlist',
      message: 'Inserisci il nome della tua nuova playlist:',
      inputs: [
        {
          name: 'playlistName',
          type: 'text',
          placeholder: 'Nome playlist'
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel',
          cssClass: 'ff7-alert-button'
        },
        {
          text: 'Crea',
          cssClass: 'ff7-alert-button primary',
          handler: data => {
            const name = data.playlistName?.trim();
            if (name) {
              this.noteService.addPlaylist(name);
            }
          }
        }
      ],
      cssClass: 'ff7-alert'
    });

    await alert.present();
  }

  async openNewNoteModal() {
    const modal = await this.modalCtrl.create({
      component: NoteEditorComponent,
      componentProps: { playlistId: this.selectedPlaylistId },
      cssClass: 'fullscreen-modal',
      showBackdrop: true
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
      cssClass: 'fullscreen-modal',
      showBackdrop: true
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
    event.preventDefault();
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

  async deleteSelectedNotes() {
    const deletionPromises = Array.from(this.selectedNoteIds).map(id =>
      firstValueFrom(this.noteService.deleteNote(id))
    );
    try {
      await Promise.all(deletionPromises);
      console.log('Note selezionate eliminate con successo.');
    } catch (error) {
      console.error('Errore durante l\'eliminazione delle note selezionate:', error);
    }

    this.cancelSelectionMode();
  }

  cancelSelectionMode() {
    this.selectedNoteIds.clear();
    this.isSelectionMode = false;
  }

  onContentClick(event: MouseEvent) {
    if (!this.isSelectionMode) return;

    const target = event.target as HTMLElement;

    if (target.closest('ion-checkbox, .note-thumbnail, ion-button, ion-fab-button')) {
      return;
    }

    this.cancelSelectionMode();
  }

  async confirmDeleteCurrentPlaylist() {
    const playlist = this.playlists.find(p => p.id === this.selectedPlaylistId);
    if (!playlist) return;

    if (playlist.id === 'all') {
      const alert = await this.alertCtrl.create({
        header: 'Impossibile eliminare',
        message: 'La playlist "All" non può essere eliminata.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Elimina Playlist',
      message: `Vuoi eliminare la playlist ${playlist.name}? Tutte le note associate saranno eliminate.`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel',
          cssClass: 'ff7-alert-button'
        },
        {
          text: 'Elimina',
          cssClass: 'ff7-alert-button danger',
          handler: async () => {
            try {
              await firstValueFrom(this.noteService.deletePlaylist(playlist.id));
              console.log(`Playlist "${playlist.name}" e le sue note eliminate con successo.`);

              this.selectedPlaylistId = 'all';
              this.filterNotes();

            } catch (error) {
              console.error('Errore durante l\'eliminazione della playlist:', error);
              const errorAlert = await this.alertCtrl.create({
                header: 'Errore',
                message: 'Si è verificato un errore durante l\'eliminazione della playlist. Riprova.',
                buttons: ['OK']
              });
              await errorAlert.present();
            }
          }
        }
      ],
      cssClass: 'ff7-alert'
    });

    await alert.present();
  }
}
