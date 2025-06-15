import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { ModalController, ActionSheetController, AlertController } from '@ionic/angular';
import { NoteService } from 'src/app/services/note.service';
import { Note } from 'src/app/interfaces/note';

@Component({
  selector: 'app-note-editor',
  templateUrl: './note-editor.component.html',
  styleUrls: ['./note-editor.component.scss'],
  standalone: false,
})
export class NoteEditorComponent implements OnInit {
  @Input() playlistId: string = 'all';
  @Input() note?: Note;

  title: string = '';
  content: string = '';

  constructor(
    private modalCtrl: ModalController,
    private noteService: NoteService,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (this.note) {
      this.title = this.note.title;
      this.content = this.note.content;
    }
  }

  save() {
    if (!this.title.trim() || !this.content.trim()) {
      return;
    }

    if (this.note) {
      const updatedNote: Note = {
        ...this.note,
        title: this.title.trim(),
        content: this.content.trim(),
      };
      this.noteService.updateNote(updatedNote);
      this.cdr.detectChanges();  // Forza il refresh della vista
      this.modalCtrl.dismiss({ note: updatedNote }, 'save');
    } else {
      const newNote: Note = {
        id: Date.now().toString(),
        title: this.title.trim(),
        content: this.content.trim(),
        playlistId: this.playlistId,
        createdAt: Date.now(),
      };
      this.noteService.addNote(newNote);
      this.cdr.detectChanges();  // Forza il refresh della vista
      this.modalCtrl.dismiss({ note: newNote }, 'save');
    }
  }

  close() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async presentOptions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Opzioni nota',
      buttons: [
        {
          text: 'Elimina',
          icon: 'trash',
          handler: () => {
            if (this.note) {
              this.noteService.deleteNote(this.note.id);
              this.modalCtrl.dismiss({ note: this.note }, 'delete');
            }
          }
        },
        {
          text: 'Sposta in un\'altra playlist',
          icon: 'swap-horizontal',
          handler: () => {
            this.presentMovePrompt();
          }
        },
        {
          text: 'Annulla',
          // role: 'cancel' non necessario qui se dava errore
        }
      ]
    });

    await actionSheet.present();
  }

  async presentMovePrompt() {
    const playlists = this.noteService.getPlaylists().filter(p => p.id !== 'all');

    const alert = await this.alertCtrl.create({
      header: 'Sposta in playlist',
      inputs: playlists.map(p => ({
        name: 'playlist',
        type: 'radio',
        label: p.name,
        value: p.id,
        checked: false
      })),
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Sposta',
          handler: (selectedPlaylistId: string) => {
            if (this.note && selectedPlaylistId) {
              const updatedNote: Note = {
                ...this.note,
                playlistId: selectedPlaylistId
              };
              this.noteService.updateNote(updatedNote);
              this.cdr.detectChanges();  // Forza il refresh
              this.modalCtrl.dismiss({ note: updatedNote }, 'move');
            }
          }
        }
      ]
    });

    await alert.present();
  }
}
