import { Component, Input, Output, EventEmitter } from '@angular/core'; // ⭐ AGGIUNGI Output e EventEmitter
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-emoji-status',
  templateUrl: './emoji-status.component.html',
  styleUrls: ['./emoji-status.component.scss'],
  imports: [CommonModule]
})
export class EmojiStatusComponent {
  @Input() status: string = 'neutral';
  @Input() editing: boolean = false; // ⭐ NUOVO Input: per sapere se il profilo è in modalità modifica
  @Output() statusSelected = new EventEmitter<string>(); // ⭐ NUOVO Output: emette l'emoji selezionata

  showPicker: boolean = false; // ⭐ NUOVO: Controlla la visibilità del picker inline

  // ⭐ NUOVO: Elenco degli stati disponibili per il picker
  availableEmojis: string[] = [
    'neutral', 'happy', 'sad', 'tired', 'focused', 'stressed', 'angry', 'chill', 'love', 'sick', 'party'
  ];

  private emojiMap: { [key: string]: string } = { // Mappa delle emoji
    happy: '😄',
    sad: '😢',
    tired: '😴',
    focused: '🧠',
    stressed: '😰',
    angry: '😠',
    chill: '😎',
    love: '😍',
    sick: '🤒',
    party: '🥳',
    neutral: '😐'
  };

  get emoji(): string {
    return this.emojiMap[this.status] || this.emojiMap['neutral'];
  }

  // ⭐ NUOVO: Metodo per ottenere l'emoji da uno stato specifico
  getEmojiByStatus(statusKey: string): string {
    return this.emojiMap[statusKey] || this.emojiMap['neutral'];
  }

  // ⭐ NUOVO: Toggle la visibilità del picker
  togglePicker() {
    if (this.editing) { // Apri il picker solo in modalità modifica
      this.showPicker = !this.showPicker;
    }
  }

  // ⭐ NUOVO: Seleziona un'emoji e la emette
  selectEmoji(newStatus: string) {
    this.statusSelected.emit(newStatus); // Emette il nuovo stato al componente padre
    this.showPicker = false; // Chiudi il picker dopo la selezione
  }
}
