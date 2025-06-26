import { Component, Input, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ModalController, ActionSheetController, AlertController } from '@ionic/angular';
import { NoteService } from 'src/app/services/note.service';
import { Note } from 'src/app/interfaces/note';

@Component({
  selector: 'app-note-editor',
  templateUrl: './note-editor.component.html',
  styleUrls: ['./note-editor.component.scss'],
  standalone: false,
})
export class NoteEditorComponent implements OnInit, AfterViewInit {
  @Input() playlistId: string = 'all';
  @Input() note?: Note;

  title: string = '';
  content: string = '';
  recording = false;
  mediaRecorder?: MediaRecorder;
  audioChunks: Blob[] = [];
  audioUrl?: string;
  audioPlayer?: HTMLAudioElement;

  audioDuration: number = 0;
  currentTime: number = 0;
  isPlaying = false;

  noteAudioBase64?: string;
  mediaElementSource?: MediaElementAudioSourceNode;

  @ViewChild('visualizerCanvas', { static: false }) visualizerCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('visualizerCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  audioContext?: AudioContext;
  analyser?: AnalyserNode;
  animationId?: number;

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

      if (this.note.audioBase64) {
        this.noteAudioBase64 = this.note.audioBase64;
        this.audioUrl = this.note.audioBase64;
        this.initAudioPlayer(); // nuova riga
      }
    }
  }



  ngAfterViewInit() {
    // setup visualizer solo se audioPlayer è pronto
    if (this.audioPlayer) {
      this.setupAudioVisualizer(this.audioPlayer);
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
      audioBase64: this.noteAudioBase64,
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

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          this.noteAudioBase64 = base64;
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(blob);

        this.initAudioPlayer(); // nuova riga
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

togglePlayback() {
  if (!this.audioUrl) return;

  // Ricrea sempre l'elemento audio per evitare il problema del binding singolo
  if (this.audioPlayer) {
    this.audioPlayer.pause();
    this.stopVisualizer();
  }

  this.audioPlayer = new Audio(this.audioUrl);
  this.isPlaying = true;

  this.audioPlayer.addEventListener('loadedmetadata', () => {
    this.audioDuration = this.audioPlayer!.duration;
    this.cdr.detectChanges();
  });

  this.audioPlayer.ontimeupdate = () => {
    this.currentTime = this.audioPlayer!.currentTime;
    this.cdr.detectChanges();
  };

  this.audioPlayer.onended = () => {
    this.isPlaying = false;
    this.currentTime = 0;
    this.stopVisualizer();
    this.cdr.detectChanges();
  };

  this.audioPlayer.play();
  this.setupAudioVisualizer(this.audioPlayer);
}


  stopVisualizer() {
  cancelAnimationFrame(this.animationId!);
  this.clearVisualizerCanvas();

  if (this.audioContext) {
    this.audioContext.close();
    this.audioContext = undefined;
  }

  this.mediaElementSource = undefined;
  this.analyser = undefined;
}


  clearVisualizerCanvas() {
    const canvas = this.canvasRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }




setupAudioVisualizer(audioElement: HTMLAudioElement) {
  if (!this.canvasRef) return;

  const canvas = this.canvasRef.nativeElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  this.audioContext = new AudioContext();

  // Important: sempre creare nuova connessione
  this.mediaElementSource = this.audioContext.createMediaElementSource(audioElement);
  this.analyser = this.audioContext.createAnalyser();
  this.mediaElementSource.connect(this.analyser);
  this.analyser.connect(this.audioContext.destination);
  this.analyser.fftSize = 128;

  const bufferLength = this.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const draw = () => {
    this.animationId = requestAnimationFrame(draw);
    if (!this.analyser) return;

    this.analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 1.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      ctx.fillStyle = '#00ffbb';
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  };

  draw();
}






  get formattedDuration(): string {
    const remaining = this.audioDuration - this.currentTime;
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }


  deleteAudio() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer = undefined;
    }

    this.audioUrl = undefined;
    this.audioDuration = 0;
    this.currentTime = 0;
    this.audioChunks = [];
    this.isPlaying = false;

    this.stopVisualizer();
    this.cdr.detectChanges();
  }



  formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  initAudioPlayer() {
    if (!this.audioUrl) return;

    if (!this.audioPlayer || this.audioPlayer.src !== this.audioUrl) {
      this.audioPlayer = new Audio(this.audioUrl);

      this.audioPlayer.addEventListener('loadedmetadata', () => {
        this.audioDuration = this.audioPlayer!.duration;
        this.cdr.detectChanges(); // forza l’aggiornamento in template
      });

      this.audioPlayer.ontimeupdate = () => {
        this.currentTime = this.audioPlayer!.currentTime;
        this.cdr.detectChanges();
      };

      this.audioPlayer.onended = () => {
        this.isPlaying = false;
        this.currentTime = 0;
        this.stopVisualizer();
        this.cdr.detectChanges();
      };
    }
  }


}
