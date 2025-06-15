import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { NoteService } from 'src/app/services/note.service';
import { Note } from 'src/app/interfaces/note';
import { ActionSheetController } from '@ionic/angular';

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
    private actionSheetCtrl: ActionSheetController
  ) { }


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
      // Modifica nota
      const updatedNote: Note = {
        ...this.note,
        title: this.title.trim(),
        content: this.content.trim(),
      };
      this.modalCtrl.dismiss({ note: updatedNote }, 'save');
    } else {
      // Nuova nota
      const newNote: Note = {
        id: Date.now().toString(),
        title: this.title.trim(),
        content: this.content.trim(),
        playlistId: this.playlistId,
        createdAt: Date.now(),
      };
      this.noteService.addNote(newNote);
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
          role: 'destructive',
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
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async presentMovePrompt() {
    const name = prompt('Inserisci ID della nuova playlist:');
    if (name && this.note) {
      const updatedNote: Note = {
        ...this.note,
        playlistId: name.trim()
      };
      this.noteService.updateNote(updatedNote);
      this.modalCtrl.dismiss({ note: updatedNote }, 'move');
    }
  }

}
