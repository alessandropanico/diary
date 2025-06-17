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
  recording = false;
  mediaRecorder?: MediaRecorder;
  audioChunks: Blob[] = [];
  audioUrl?: string;
  audioPlayer?: HTMLAudioElement;

  constructor(
    private modalCtrl: ModalController,
    private noteService: NoteService,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    if (this.note) {
      this.title = this.note.title;
      this.content = this.note.content;
      this.audioUrl = this.note.audioUrl;
    }
  }

  save() {
    if (!this.title.trim() || (!this.content.trim() && !this.audioUrl)) {
      return;
    }

    const noteData: Note = {
      id: this.note?.id || Date.now().toString(),
      title: this.title.trim(),
      content: this.content.trim(),
      playlistId: this.note?.playlistId || this.playlistId,
      createdAt: this.note?.createdAt || Date.now(),
      audioUrl: this.audioUrl,
    };

    if (this.note) {
      this.noteService.updateNote(noteData);
    } else {
      this.noteService.addNote(noteData);
    }

    this.cdr.detectChanges();
    this.modalCtrl.dismiss({ note: noteData }, 'save');
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
          text: 'Annulla'
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
              this.cdr.detectChanges();
              this.modalCtrl.dismiss({ note: updatedNote }, 'move');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioUrl = URL.createObjectURL(blob);
        this.cdr.detectChanges();
      };

      this.mediaRecorder.start();
      this.recording = true;
    }).catch(err => {
      alert('Errore accesso microfono: ' + err);
    });
  }

  stopRecording() {
    this.mediaRecorder?.stop();
    this.recording = false;
  }

  playAudio() {
    if (this.audioUrl) {
      this.audioPlayer = new Audio(this.audioUrl);
      this.audioPlayer.play();
    }
  }
}
