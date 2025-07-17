/* src/app/components/emoji-status/emoji-status.component.ts */

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-emoji-status',
  templateUrl: './emoji-status.component.html',
  styleUrls: ['./emoji-status.component.scss'],
  imports: [CommonModule]
})
export class EmojiStatusComponent implements OnInit {
  @Input() status: string = 'neutral';
  @Input() editing: boolean = false;
  @Output() statusSelected = new EventEmitter<string>();

  showPicker: boolean = false;

  availableEmojis: string[] = [
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

  getEmojiByStatus(statusKey: string): string {
    return this.emojiMap[statusKey] || this.emojiMap['neutral'];
  }

  // ⭐ MODIFICA QUI: Aggiungi 'event: Event' come parametro ⭐
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
