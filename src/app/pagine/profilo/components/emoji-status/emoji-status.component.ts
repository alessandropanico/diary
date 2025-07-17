/* src/app/components/emoji-status/emoji-status.component.ts */

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Assicurati che CommonModule sia importato se necessario

@Component({
  selector: 'app-emoji-status',
  templateUrl: './emoji-status.component.html',
  styleUrls: ['./emoji-status.component.scss'],
  imports: [CommonModule] // Se il componente è standalone, altrimenti rimuovi questa riga
})
export class EmojiStatusComponent implements OnInit {
  @Input() status: string = ''; // ⭐ Modifica qui: Il default per lo status dovrebbe essere una stringa vuota
  @Input() editing: boolean = false;
  @Output() statusSelected = new EventEmitter<string>();

  showPicker: boolean = false;

  // ⭐ Aggiungi un'opzione per 'nessuno status' (stringa vuota) all'inizio
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
    // Non è necessario fare nulla qui in OnInit
  }

  // ⭐ Aggiorna la logica per mostrare l'emoji corretta o l'indicatore di "nessuno status" ⭐
  getEmojiByStatus(statusKey: string): string {
    // Se lo status è vuoto, ritorna una stringa vuota. L'HTML deciderà cosa mostrare.
    if (statusKey === '') {
      return ''; // Non mostrare un carattere emoji diretto qui, l'HTML gestirà ion-icon
    }
    return this.emojiMap[statusKey] || this.emojiMap['neutral'];
  }

  togglePicker(event: Event) {
    if (this.editing) {
      event.stopPropagation();
      this.showPicker = !this.showPicker;
    }
  }

  selectEmoji(newStatus: string, event: Event) {
    event.stopPropagation();
    this.statusSelected.emit(newStatus);
    this.showPicker = false;
  }
}
