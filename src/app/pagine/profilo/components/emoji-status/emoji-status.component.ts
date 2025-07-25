import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-emoji-status',
  templateUrl: './emoji-status.component.html',
  styleUrls: ['./emoji-status.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class EmojiStatusComponent implements OnInit {
  @Input() status: string = '';
  @Input() editing: boolean = false;
  @Output() statusSelected = new EventEmitter<string>();

  showPicker: boolean = false;

  availableEmojis: string[] = [
    '',
    'neutral', 'happy', 'sad', 'tired', 'focused', 'stressed', 'angry', 'chill', 'love', 'sick', 'party', 'fire'
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
    neutral: '😐',
    fire: '🔥',
  };

  ngOnInit() {

  }

  getEmojiByStatus(statusKey: string): string {
    if (statusKey === '') {
      return '';
    }
    const emoji = this.emojiMap[statusKey] || this.emojiMap['neutral'];
    return emoji;
  }

  togglePicker(event: Event) {
    if (this.editing) {
      event.stopPropagation();
      this.showPicker = !this.showPicker;
    }
  }

  closePicker() {
    if (this.editing) {
      this.showPicker = false;
    }
  }

  selectEmoji(newStatus: string, event: Event) {
    event.stopPropagation();
    this.statusSelected.emit(newStatus);
    this.showPicker = false;
  }
}
