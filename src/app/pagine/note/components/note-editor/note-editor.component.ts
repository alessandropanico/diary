import { Component, Input, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core'; // Aggiunto OnDestroy
import { ModalController, ActionSheetController, AlertController } from '@ionic/angular';
import { NoteService } from 'src/app/services/note.service';
import { Note } from 'src/app/interfaces/note';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-note-editor',
  templateUrl: './note-editor.component.html',
  styleUrls: ['./note-editor.component.scss'],
  standalone: false,
})
export class NoteEditorComponent implements OnInit, AfterViewInit, OnDestroy {
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

  progressInterval?: any;

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

      if (this.note.audioUrl) {
        this.audioUrl = this.note.audioUrl;
        this.initAudioPlayer();
      } else if (this.note.audioBase64) {
        this.noteAudioBase64 = this.note.audioBase64;
        this.audioUrl = this.note.audioBase64;
        this.initAudioPlayer();
      }
    }
  }

  ngAfterViewInit() {
    if (this.audioPlayer) {
      this.setupAudioVisualizer(this.audioPlayer);
    }
  }

  async save() {
    if (!this.title.trim()) {
      console.warn('Il titolo della nota non può essere vuoto.');
      return;
    }

    const noteDataToSend: Partial<Note> = {
      id: this.note?.id || uuidv4(),
      title: this.title.trim(),
      content: this.content.trim(),
      playlistId: this.note?.playlistId || this.playlistId,
      createdAt: this.note?.createdAt,
    };

    if (this.audioUrl) {
      noteDataToSend.audioUrl = this.audioUrl;
    }

    if (this.noteAudioBase64) {
      noteDataToSend.audioBase64 = this.noteAudioBase64;
    }

    try {
      if (this.note) {
        await firstValueFrom(this.noteService.updateNote(noteDataToSend as Note));
      } else {
        await firstValueFrom(this.noteService.addNote(noteDataToSend as Note));
      }
      this.noteAudioBase64 = undefined;
      this.modalCtrl.dismiss({ note: noteDataToSend }, 'save');
    } catch (error) {
      console.error('Errore durante il salvataggio della nota:', error);
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
          handler: async () => {
            if (this.note && this.note.id) {
              try {
                await firstValueFrom(this.noteService.deleteNote(this.note.id));
                this.modalCtrl.dismiss({ note: this.note }, 'delete');
              } catch (error) {
                console.error('Errore durante l\'eliminazione della nota:', error);
              }
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
    const playlists = this.noteService.getPlaylistsSnapshot().filter(p => p.id !== 'all');

    const alert = await this.alertCtrl.create({
      header: 'Sposta in playlist',
      inputs: playlists.map(p => ({
        name: 'playlist',
        type: 'radio',
        label: p.name,
        value: p.id,
        checked: this.note?.playlistId === p.id
      })),
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Sposta',
          handler: async (selectedPlaylistId: string) => {
            if (this.note && selectedPlaylistId && this.note.playlistId !== selectedPlaylistId) {
              const updatedNote: Note = {
                ...this.note,
                playlistId: selectedPlaylistId,
                updatedAt: undefined
              };
              try {
                await firstValueFrom(this.noteService.updateNote(updatedNote));
                this.cdr.detectChanges();
                this.modalCtrl.dismiss({ note: updatedNote }, 'move');
              } catch (error) {
                console.error('Errore durante lo spostamento della nota:', error);
              }
            } else if (this.note?.playlistId === selectedPlaylistId) {
              return true;
            }
            return true;
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

        this.initAudioPlayer();
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start();
      this.recording = true;
      this.cdr.detectChanges();
    }).catch(err => {
      alert('Errore accesso microfono: ' + err);
      console.error('Errore accesso microfono:', err);
    });
  }

  stopRecording() {
    this.mediaRecorder?.stop();
    this.recording = false;
    this.cdr.detectChanges();
  }

  togglePlayback() {
    if (!this.audioUrl) return;

    if (!this.audioPlayer) {
      this.initAudioPlayer();
    }

    if (this.audioPlayer) {
      if (this.isPlaying) {
        this.audioPlayer.pause();
        clearInterval(this.progressInterval);
        this.isPlaying = false;
        this.stopVisualizer();
      } else {
        this.audioPlayer.play();
        this.isPlaying = true;

        this.progressInterval = setInterval(() => {
          if (this.audioPlayer) {
            this.currentTime = this.audioPlayer.currentTime;
            this.audioDuration = this.audioPlayer.duration || this.audioDuration;
            this.cdr.detectChanges();
          }
        }, 200);

        this.setupAudioVisualizer(this.audioPlayer);
      }
    }
    this.cdr.detectChanges();
  }

  stopVisualizer() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }

    this.clearVisualizerCanvas();

    if (this.audioContext) {
      this.audioContext.close().then(() => {
        this.audioContext = undefined;
        this.mediaElementSource = undefined;
        this.analyser = undefined;
      }).catch(err => console.error("Errore chiusura AudioContext:", err));
    }
  }

  clearVisualizerCanvas() {
    const canvas = this.canvasRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  setupAudioVisualizer(audioElement: HTMLAudioElement) {
    if (!this.canvasRef || !audioElement) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.audioContext) {
      this.audioContext.close();
    }
    this.audioContext = new AudioContext();

    this.mediaElementSource = this.audioContext.createMediaElementSource(audioElement);
    this.analyser = this.audioContext.createAnalyser();
    this.mediaElementSource.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
    this.analyser.fftSize = 128;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!this.isPlaying || !this.analyser || !this.audioContext || this.audioContext.state === 'closed') {
        this.stopVisualizer();
        return;
      }
      this.animationId = requestAnimationFrame(draw);

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

    if (this.isPlaying) {
      draw();
    }
  }

  get formattedDuration(): string {
    return this.formatDuration(this.audioDuration - this.currentTime);
  }

  deleteAudio() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer = undefined;
    }

    this.audioUrl = undefined;
    this.noteAudioBase64 = undefined;
    this.audioDuration = 0;
    this.currentTime = 0;
    this.audioChunks = [];
    this.isPlaying = false;

    this.stopVisualizer();
    clearInterval(this.progressInterval);
    this.cdr.detectChanges();
  }

  initAudioPlayer() {
    if (!this.audioUrl) return;

    if (this.audioPlayer && this.audioPlayer.src === this.audioUrl) {
      return;
    }

    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer = undefined;
    }

    this.audioPlayer = new Audio(this.audioUrl);

    this.audioPlayer.addEventListener('loadedmetadata', () => {
      this.audioDuration = this.audioPlayer!.duration;

      if (isNaN(this.audioDuration) || this.audioDuration === Infinity) {
        setTimeout(() => {
          if (this.audioPlayer) {
            this.audioDuration = this.audioPlayer.duration;
            this.cdr.detectChanges();
          }
        }, 500);
      }
      this.cdr.detectChanges();
    }, { once: true });

    this.audioPlayer.addEventListener('timeupdate', () => {
      this.currentTime = this.audioPlayer!.currentTime;
    });

    this.audioPlayer.addEventListener('ended', () => {
      if (this.audioPlayer) {
        this.audioPlayer.currentTime = 0;
        this.currentTime = 0;

        setTimeout(() => {
          if (this.audioPlayer) {
            this.audioDuration = this.audioPlayer.duration || 1;
            this.cdr.detectChanges();
          }
        }, 50);

        this.isPlaying = false;
        clearInterval(this.progressInterval);
        this.stopVisualizer();
      }
    });
  }

  formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  seekAudio(event: MouseEvent) {
    if (!this.audioPlayer || !this.audioDuration || !this.audioUrl) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;

    const newTime = percentage * this.audioDuration;
    this.audioPlayer.currentTime = newTime;
    this.currentTime = newTime;
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      // È buona pratica rimuovere i listener specifici se non si usa { once: true } ovunque
      // Tuttavia, se si usa { once: true }, non sono strettamente necessari qui
      // this.audioPlayer.removeEventListener('loadedmetadata', () => {});
      // this.audioPlayer.removeEventListener('timeupdate', () => {});
      // this.audioPlayer.removeEventListener('ended', () => {});
      this.audioPlayer = undefined;
    }
    clearInterval(this.progressInterval);
    this.stopVisualizer();
  }
}
