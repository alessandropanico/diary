// src/app/pagine/chat-list/chat-list.page.ts
import { Component, OnInit, OnDestroy, ViewChildren, QueryList } from '@angular/core';
import {
  ChatService,
  ConversationDocument,
  ExtendedConversation,
  UserProfile
} from 'src/app/services/chat.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Subscription, forkJoin, of, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ChatNotificationService } from 'src/app/services/chat-notification.service';
import { Timestamp } from 'firebase/firestore';
import { AlertController, IonItemSliding } from '@ionic/angular';

import * as dayjs from 'dayjs';
import 'dayjs/locale/it';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import updateLocale from 'dayjs/plugin/updateLocale';

dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.extend(updateLocale);
dayjs.locale('it');

dayjs.updateLocale('it', {
  months: [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ],
  weekdays: [
    "Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"
  ],
  weekdaysShort: [
    "Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"
  ]
});

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.page.html',
  styleUrls: ['./chat-list.page.scss'],
  standalone: false,
})
export class ChatListPage implements OnInit, OnDestroy {

  conversations: ExtendedConversation[] = [];
  loggedInUserId: string | null = null;
  isLoading: boolean = true;

  isSelectionMode: boolean = false;
  selectedConversations: Set<string> = new Set<string>();

  auth = getAuth();

  private authStateUnsubscribe: (() => void) | undefined;
  private conversationsSubscription: Subscription | undefined;
  private onlineStatusInterval: any; // ⭐ Aggiunto per il controllo dello stato online

  @ViewChildren(IonItemSliding) slidingItems!: QueryList<IonItemSliding>;

  constructor(
    private chatService: ChatService,
    private userDataService: UserDataService,
    private router: Router,
    private chatNotificationService: ChatNotificationService,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.isLoading = true;
    const auth = getAuth();

    this.authStateUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.loggedInUserId = user.uid;
        this.loadUserConversations();
        this.startOnlineStatusCheck(); // ⭐ Avvia il controllo dello stato online
      } else {
        this.loggedInUserId = null;
        this.conversations = [];
        this.isLoading = false;
        this.router.navigateByUrl('/login');
        this.stopOnlineStatusCheck(); // ⭐ Ferma il controllo dello stato online
      }
    });
  }

  ngOnDestroy(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    if (this.conversationsSubscription) {
      this.conversationsSubscription.unsubscribe();
    }
    this.stopOnlineStatusCheck(); // ⭐ Assicurati che l'intervallo sia fermato alla distruzione del componente
  }

  async loadUserConversations() {
    if (!this.loggedInUserId) {
      console.warn('ChatListPage: Impossibile caricare le conversazioni, loggedInUserId è nullo.');
      this.isLoading = false;
      return;
    }

    this.conversationsSubscription = this.chatService.getUserConversations(this.loggedInUserId)
      .pipe(
        map((rawConvs: ConversationDocument[]) => {
          return rawConvs.filter(conv =>
            !(conv.deletedBy && conv.deletedBy.includes(this.loggedInUserId!))
          );
        }),
        switchMap((filteredConvs: ConversationDocument[]) => {
          if (filteredConvs.length === 0) {
            return of([]);
          }

          const extendedConvsObservables = filteredConvs.map(conv => {
            const otherParticipantId = conv.participants.find(id => id !== this.loggedInUserId);

            const userProfileObservable = otherParticipantId
              ? from(this.userDataService.getUserDataById(otherParticipantId))
              : of(null);

            return userProfileObservable.pipe(
              switchMap(async (otherUserData: UserProfile | null) => {
                const lastMessageAtDate = conv.lastMessageAt?.toDate();
                const lastReadByMe: Timestamp | null = conv.lastRead?.[this.loggedInUserId!] ?? null;

                const unreadCountForChat = await this.chatService.countUnreadMessages(
                  conv.id,
                  this.loggedInUserId!,
                  lastReadByMe
                );

                const hasUnread = unreadCountForChat > 0;

                // ⭐ Calcolo dello stato online dell'altro partecipante
                const { isOnline, lastOnlineDisplay } = this.getOnlineStatus(otherUserData?.lastOnline);

                const extendedConv: ExtendedConversation = {
                  id: conv.id,
                  participants: conv.participants,
                  lastMessage: conv.lastMessage || '',
                  lastMessageAt: conv.lastMessageAt || null,
                  createdAt: conv.createdAt || null,
                  chatId: conv.id,
                  otherParticipantId: otherParticipantId || '',
                  otherParticipantName: otherUserData?.nickname || otherUserData?.name || 'Utente Sconosciuto',
                  otherParticipantPhoto: otherUserData?.photo || 'assets/immaginiGenerali/default-avatar.jpg',
                  displayLastMessageAt: lastMessageAtDate ? this.formatDate(lastMessageAtDate) : 'N/A',
                  lastMessageSenderId: conv.lastMessageSenderId || '',
                  lastRead: conv.lastRead || {},
                  hasUnreadMessages: hasUnread,
                  unreadMessageCount: unreadCountForChat,
                  deletedBy: conv.deletedBy || [],
                  // ⭐ Assegna i valori calcolati
                  otherParticipantIsOnline: isOnline,
                  otherParticipantLastOnline: lastOnlineDisplay
                };

                if (hasUnread && !(extendedConv.deletedBy && extendedConv.deletedBy.includes(this.loggedInUserId!))) {
                  this.chatNotificationService.incrementUnread(conv.id);
                } else {
                  this.chatNotificationService.clearUnread(conv.id);
                }

                return extendedConv;
              }),
              catchError(error => {
                console.error('Errore durante l\'arricchimento della conversazione con dati utente:', conv.id, error);
                const lastMessageAtDate = conv.lastMessageAt?.toDate();

                return of({
                  id: conv.id,
                  participants: conv.participants,
                  lastMessage: conv.lastMessage || '',
                  lastMessageAt: conv.lastMessageAt || null,
                  createdAt: conv.createdAt || null,
                  chatId: conv.id,
                  otherParticipantId: otherParticipantId || '',
                  otherParticipantName: 'Errore Utente',
                  otherParticipantPhoto: 'assets/immaginiGenerali/default-avatar.jpg',
                  displayLastMessageAt: lastMessageAtDate ? this.formatDate(lastMessageAtDate) : 'N/A',
                  lastMessageSenderId: conv.lastMessageSenderId || '',
                  lastRead: conv.lastRead || {},
                  hasUnreadMessages: false,
                  unreadMessageCount: 0,
                  deletedBy: conv.deletedBy || [],
                  // ⭐ In caso di errore, imposta lo stato online di default
                  otherParticipantIsOnline: false,
                  otherParticipantLastOnline: 'N/D'
                } as ExtendedConversation);
              })
            );
          });

          return forkJoin(extendedConvsObservables);
        })
      )
      .subscribe({
        next: (processedConvs: ExtendedConversation[]) => {
          this.conversations = processedConvs.sort((a, b) => {
            const dateA = a.lastMessageAt ? a.lastMessageAt.toMillis() : 0;
            const dateB = b.lastMessageAt ? b.lastMessageAt.toMillis() : 0;
            return dateB - dateA;
          });
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Errore nel recupero o elaborazione delle conversazioni:', error);
          this.isLoading = false;
        }
      });
  }

  // ⭐⭐ NUOVI METODI PER LA GESTIONE DELLO STATO ONLINE ⭐⭐

  private startOnlineStatusCheck() {
    // Aggiorna lo stato ogni 30 secondi (o il valore desiderato)
    this.onlineStatusInterval = setInterval(() => {
      this.updateOnlineStatusForConversations();
    }, 30000); // 30 secondi
  }

  private stopOnlineStatusCheck() {
    if (this.onlineStatusInterval) {
      clearInterval(this.onlineStatusInterval);
      this.onlineStatusInterval = null;
    }
  }

  /**
   * Aggiorna lo stato online per tutte le conversazioni esistenti.
   * Chiamato periodicamente dall'intervallo.
   */
  private updateOnlineStatusForConversations() {
    if (this.conversations && this.conversations.length > 0) {
      this.conversations = this.conversations.map(conv => {
        // Non abbiamo i dati UserProfile qui, ma abbiamo otherParticipantLastOnline
        // che ci è stato passato dal chat.service
        const { isOnline, lastOnlineDisplay } = this.getOnlineStatus(conv.otherParticipantLastOnline);
        return {
          ...conv,
          otherParticipantIsOnline: isOnline,
          otherParticipantLastOnline: lastOnlineDisplay
        };
      });
      // console.log('Stato online conversazioni aggiornato:', this.conversations.map(c => ({ id: c.id, online: c.otherParticipantIsOnline, lastOnline: c.otherParticipantLastOnline })));
    }
  }

  /**
   * Determina se un utente è online e restituisce una stringa formattata per l'ultima attività.
   * @param lastOnlineTimestamp La stringa ISO del timestamp dell'ultima attività.
   * @returns Un oggetto con 'isOnline' (boolean) e 'lastOnlineDisplay' (stringa formattata).
   */
  getOnlineStatus(lastOnlineTimestamp: string | undefined): { isOnline: boolean, lastOnlineDisplay: string } {
    if (!lastOnlineTimestamp) {
      return { isOnline: false, lastOnlineDisplay: 'Offline' };
    }

    const lastOnline = dayjs(lastOnlineTimestamp);
    const now = dayjs();
    const diffSeconds = now.diff(lastOnline, 'second');

    // Considera online se l'ultima attività è avvenuta negli ultimi X secondi (es. 60 secondi)
    const isOnline = diffSeconds <= 60; // 60 secondi di tolleranza per considerare online

    let lastOnlineDisplay: string;
    if (isOnline) {
      lastOnlineDisplay = 'Online';
    } else if (lastOnline.isToday()) {
      lastOnlineDisplay = `Oggi alle ${lastOnline.format('HH:mm')}`;
    } else if (lastOnline.isYesterday()) {
      lastOnlineDisplay = 'Ieri';
    } else if (lastOnline.year() === now.year()) {
      lastOnlineDisplay = lastOnline.format('D MMM');
    } else {
      lastOnlineDisplay = lastOnline.format('D MMM YYYY');
    }

    return { isOnline, lastOnlineDisplay };
  }

  // ⭐⭐ FINE NUOVI METODI ⭐⭐

  openChat(conversationId: string) {
    if (!this.isSelectionMode) {
      this.router.navigate(['/chat', conversationId]);
    }
  }

  formatDate(date: Date): string {
    const d = dayjs(date);
    if (d.isToday()) {
      return d.format('HH:mm');
    } else if (d.isYesterday()) {
      return 'Ieri';
    } else if (d.year() === dayjs().year()) {
      return d.format('D MMM');
    } else {
      return d.format('D MMM YYYY');
    }
  }

  isLastMessageFromMe(conversation: ExtendedConversation): boolean {
    return conversation.lastMessageSenderId === this.loggedInUserId;
  }

  hasUnreadMessages(conversation: ExtendedConversation): boolean {
    return (
      conversation.unreadMessageCount !== undefined &&
      conversation.unreadMessageCount > 0
    );
  }

  getDisplayLastMessage(conversation: ExtendedConversation): string {
    const prefix = this.isLastMessageFromMe(conversation) ? 'Tu: ' : '';
    return prefix + (conversation.lastMessage || '');
  }

  async deleteConversation(conversation: ExtendedConversation) {
    if (!this.loggedInUserId) {
      console.error('Errore: Utente non autenticato per eliminare la chat.');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Elimina Chat',
      message: `Sei sicuro di voler eliminare la conversazione con ${conversation.otherParticipantName}?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina',
          handler: async () => {
            try {
              await this.chatService.markConversationAsDeleted(conversation.id, this.loggedInUserId!);
              this.chatNotificationService.clearUnread(conversation.id);
            } catch (error) {
              console.error('Errore durante l\'eliminazione della chat:', error);
              const errorAlert = await this.alertController.create({
                header: 'Errore',
                message: 'Impossibile eliminare la chat. Riprova.',
                buttons: ['OK'],
              });
              await errorAlert.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  toggleSelectionMode() {
    this.isSelectionMode = !this.isSelectionMode;
    if (!this.isSelectionMode) {
      this.selectedConversations.clear();
    } else {
      this.closeAllSlidingItems();
    }
  }

  private async closeAllSlidingItems() {
    if (this.slidingItems) {
      this.slidingItems.forEach(async (item: IonItemSliding) => {
        await item.closeOpened();
      });
    }
  }

  toggleConversationSelection(conversationId: string) {
    if (this.isConversationSelected(conversationId)) {
      this.selectedConversations.delete(conversationId);
    } else {
      this.selectedConversations.add(conversationId);
    }
  }

  isConversationSelected(conversationId: string): boolean {
    return this.selectedConversations.has(conversationId);
  }

  async deleteSelectedConversations() {
    if (this.selectedConversations.size === 0) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Elimina Chat Selezionate',
      message: `Sei sicuro di voler eliminare le ${this.selectedConversations.size} conversazioni selezionate? Questa azione le rimuoverà dalla tua lista e non potrai più vedere i messaggi precedenti se avvierai nuove chat con questi utenti.`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina Tutto',
          handler: async () => {
            if (!this.loggedInUserId) {
              console.error('Errore: Utente non autenticato per eliminare le chat.');
              return;
            }

            const deletePromises: Promise<void>[] = [];
            for (const convId of this.selectedConversations) {
              deletePromises.push(this.chatService.markConversationAsDeleted(convId, this.loggedInUserId!));
              this.chatNotificationService.clearUnread(convId);
            }

            try {
              await Promise.all(deletePromises);
              this.selectedConversations.clear();
              this.isSelectionMode = false;
              console.log('Chat selezionate eliminate con successo.');
            } catch (error) {
              console.error('Errore durante l\'eliminazione in blocco delle chat:', error);
              const errorAlert = await this.alertController.create({
                header: 'Errore',
                message: 'Impossibile eliminare alcune chat. Riprova.',
                buttons: ['OK'],
              });
              await errorAlert.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
