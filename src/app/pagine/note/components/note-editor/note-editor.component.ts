import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { NoteService } from 'src/app/services/note.service';
import { Note } from 'src/app/interfaces/note';

@Component({
  selector: 'app-note-editor',
  templateUrl: './note-editor.component.html',
  styleUrls: ['./note-editor.component.scss'],
  standalone: false,
})
export class NoteEditorComponent {
  @Input() playlistId: string = 'all';

  title = '';
  content = '';

  constructor(
    private modalCtrl: ModalController,
    private noteService: NoteService
  ) {}

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  saveNote() {
    if (!this.title.trim() || !this.content.trim()) return;

    const newNote: Note = {
      id: Date.now().toString(),
      title: this.title.trim(),
      content: this.content.trim(),
      playlistId: this.playlistId,
      createdAt: Date.now(),
    };

    this.noteService.addNote(newNote);
    this.modalCtrl.dismiss(newNote, 'save');
  }
}
