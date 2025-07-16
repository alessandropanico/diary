// src/app/pagine/chat-list/chat-list.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { AlertController } from '@ionic/angular';

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

  // ✅ NUOVE PROPRIETÀ PER LA SELEZIONE MULTIPLA
  isSelectionMode: boolean = false; // Indica se la modalità di selezione è attiva
  selectedConversations: Set<string> = new Set<string>(); // Set degli ID delle conversazioni selezionate

  auth = getAuth();

  private authStateUnsubscribe: (() => void) | undefined;
  private conversationsSubscription: Subscription | undefined;

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
                  deletedBy: conv.deletedBy || []
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
                  deletedBy: conv.deletedBy || []
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
    // Non aprire la chat se in modalità selezione
    if (!this.isSelectionMode) {
      this.router.navigate(['/chat', conversationId]);
    }
  }

  formatDate(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ieri';
    } else if (today.getFullYear() === date.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString();
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
    const prefix = this.isLastMessageFromMe(conversation) ? 'Io: ' : '';
    return prefix + (conversation.lastMessage || '');
  }

  /**
   * Mostra un alert di conferma e poi "elimina" una conversazione per l'utente corrente.
   * L'eliminazione aggiunge l'ID dell'utente al campo 'deletedBy' della conversazione.
   * @param conversation La conversazione da "eliminare".
   */
  async deleteConversation(conversation: ExtendedConversation) {
    if (!this.loggedInUserId) {
      console.error('Errore: Utente non autenticato per eliminare la chat.');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Elimina Chat',
      message: `Sei sicuro di voler eliminare la conversazione con ${conversation.otherParticipantName}? Questa azione la rimuoverà dalla tua lista e non potrai più vedere i messaggi precedenti se avvierai una nuova chat con questo utente.`,
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

  // ✅ NUOVI METODI PER LA SELEZIONE MULTIPLA

  /**
   * Attiva o disattiva la modalità di selezione multipla.
   */
  toggleSelectionMode() {
    this.isSelectionMode = !this.isSelectionMode;
    if (!this.isSelectionMode) {
      // Se si esce dalla modalità di selezione, deseleziona tutto
      this.selectedConversations.clear();
    }
  }

  /**
   * Seleziona/deseleziona una conversazione in modalità di selezione.
   * @param conversationId L'ID della conversazione da selezionare/deselezionare.
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
              deletePromises.push(this.chatService.markConversationAsDeleted(convId, this.loggedInUserId!));
              this.chatNotificationService.clearUnread(convId); // Pulisci le notifiche anche qui
            }

            try {
              await Promise.all(deletePromises);
              this.selectedConversations.clear(); // Pulisci le selezioni
              this.isSelectionMode = false; // Esci dalla modalità di selezione
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
