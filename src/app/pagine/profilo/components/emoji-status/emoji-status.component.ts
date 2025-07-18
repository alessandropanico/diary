// src/app/components/emoji-status/emoji-status.component.ts
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-emoji-status',
  templateUrl: './emoji-status.component.html',
  styleUrls: ['./emoji-status.component.scss'], // Assicurati di avere questo file
  standalone: true, // ⭐ Ricorda di impostare 'standalone: true' se lo usi, altrimenti rimuovilo e importa CommonModule nel modulo padre.
  imports: [CommonModule]
})
export class EmojiStatusComponent implements OnInit {
  @Input() status: string = '';
  @Input() editing: boolean = false;
  @Output() statusSelected = new EventEmitter<string>();

  showPicker: boolean = false;

  availableEmojis: string[] = [
    '', // Rappresenta 'nessuno status' o 'rimuovi status'
    'neutral', 'happy', 'sad', 'tired', 'focused', 'stressed', 'angry', 'chill', 'love', 'sick', 'party'
  ];

  private emojiMap: { [key: string]: string } = {
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

  ngOnInit() {
    // Log di debug (puoi lasciarli o rimuoverli una volta che tutto funziona)
    // console.log('EmojiStatusComponent: Inizializzato con status:', this.status);
  }

  getEmojiByStatus(statusKey: string): string {
    if (statusKey === '') {
      // console.log('EmojiStatusComponent: getEmojiByStatus riceve stringa vuota, restituisce stringa vuota.');
      return ''; // Importante! Ritorna stringa vuota per la X nel badge
    }
    const emoji = this.emojiMap[statusKey] || this.emojiMap['neutral'];
    // console.log('EmojiStatusComponent: getEmojiByStatus per', statusKey, 'restituisce', emoji);
    return emoji;
  }

  togglePicker(event: Event) {
    if (this.editing) {
      event.stopPropagation();
      this.showPicker = !this.showPicker;
      // console.log('EmojiStatusComponent: togglePicker. showPicker:', this.showPicker);
    }
  }

  selectEmoji(newStatus: string, event: Event) {
    event.stopPropagation();
    // console.log('EmojiStatusComponent: Emoji selezionata:', newStatus);
    this.statusSelected.emit(newStatus);
    this.showPicker = false;
  }
}
