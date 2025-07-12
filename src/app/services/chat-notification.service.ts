import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface UnreadMessagesMap {
  [chatId: string]: number;
}

@Injectable({ providedIn: 'root' })
export class ChatNotificationService {
  private unreadMessages: UnreadMessagesMap = {};
  private unreadCount$ = new BehaviorSubject<number>(0);

  getUnreadCount$() {
    return this.unreadCount$.asObservable();
  }

  getUnreadCountForChat(chatId: string): number {
    return this.unreadMessages[chatId] || 0;
  }

  incrementUnread(chatId: string) {
    this.unreadMessages[chatId] = (this.unreadMessages[chatId] || 0) + 1;
    this.updateTotalUnread();
  }

  clearUnread(chatId: string) {
    delete this.unreadMessages[chatId];
    this.updateTotalUnread();
  }

  private updateTotalUnread() {
    const total = Object.values(this.unreadMessages).reduce((a, b) => a + b, 0);
    this.unreadCount$.next(total);
  }
}
