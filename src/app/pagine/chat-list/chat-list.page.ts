// src/app/pagine/chat-list/chat-list.page.ts
import { Component, OnInit, OnDestroy, ViewChildren, QueryList } from '@angular/core'; // Aggiunti ViewChildren e QueryList
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
import { AlertController, IonItemSliding } from '@ionic/angular'; // Aggiunto IonItemSliding

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

  // Aggiunto ViewChildren per ottenere tutti gli ion-item-sliding
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
      } else {
        this.loggedInUserId = null;
        this.conversations = [];
        this.isLoading = false;
        this.router.navigateByUrl('/login');
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
          // Mantieni il filtro basato su deletedBy se è ancora rilevante per la tua logica
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
                  // Non includere 'eliminato' se non vuoi più gestirlo
                  // eliminato: conv.eliminato || {}
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
                  // Non includere 'eliminato' se non vuoi più gestirlo
                  // eliminato: conv.eliminato || {}
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
              // Rimuovi la chiamata a markConversationAsDeleted se non vuoi più usare il campo 'eliminato'
              // Se la tua logica di eliminazione è basata su 'deletedBy', mantienila come segue:
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

  /**
   * Attiva o disattiva la modalità di selezione multipla.
   */
  toggleSelectionMode() {
    this.isSelectionMode = !this.isSelectionMode;
    if (!this.isSelectionMode) {
      this.selectedConversations.clear();
    } else {
      // Chiudi tutti gli ion-item-sliding aperti quando si entra in modalità selezione
      this.closeAllSlidingItems();
    }
  }

  /**
   * Chiude tutti gli ion-item-sliding aperti.
   * Chiamato quando si entra in modalità selezione.
   */
  private async closeAllSlidingItems() {
    if (this.slidingItems) {
      this.slidingItems.forEach(async (item: IonItemSliding) => {
        await item.closeOpened();
      });
    }
  }

  /**
   * Seleziona/deseleziona una conversazione in modalità di selezione.
   * @param conversationId L'ID della conversazione.
   */
  toggleConversationSelection(conversationId: string) {
    if (this.isConversationSelected(conversationId)) {
      this.selectedConversations.delete(conversationId);
    } else {
      this.selectedConversations.add(conversationId);
    }
  }

  /**
   * Controlla se una conversazione è selezionata.
   * @param conversationId L'ID della conversazione.
   * @returns Vero se la conversazione è selezionata, falso altrimenti.
   */
  isConversationSelected(conversationId: string): boolean {
    return this.selectedConversations.has(conversationId);
  }

  /**
   * Elimina tutte le conversazioni selezionate.
   */
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
              // Rimuovi la chiamata a markConversationAsDeleted se non vuoi più usare il campo 'eliminato'
              // Se la tua logica di eliminazione è basata su 'deletedBy', mantienila come segue:
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
