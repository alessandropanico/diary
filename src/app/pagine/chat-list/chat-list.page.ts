// src/app/pagine/chat-list/chat-list.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  ChatService,
  ConversationDocument, // Importa l'interfaccia grezza del documento
  ExtendedConversation, // Importa l'interfaccia estesa per la UI
  UserProfile // Importa UserProfile per i dati dell'altro utente
} from 'src/app/services/chat.service'; // Importa le interfacce dal tuo chat.service.ts
import { UserDataService } from 'src/app/services/user-data.service';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Subscription, forkJoin, of, from } from 'rxjs'; // Importa forkJoin, of E 'from'
import { map, switchMap, catchError } from 'rxjs/operators'; // Importa gli operatori RxJS
import { Router } from '@angular/router';
import { ChatNotificationService } from 'src/app/services/chat-notification.service'; // Importa il servizio di notifica
import { Timestamp } from 'firebase/firestore'; // Importa Timestamp per il confronto

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.page.html',
  styleUrls: ['./chat-list.page.scss'],
  standalone: false,
})
export class ChatListPage implements OnInit, OnDestroy {

  conversations: ExtendedConversation[] = []; // Usa l'interfaccia ExtendedConversation
  loggedInUserId: string | null = null;
  isLoading: boolean = true;

  private authStateUnsubscribe: (() => void) | undefined;
  private conversationsSubscription: Subscription | undefined;

  constructor(
    private chatService: ChatService,
    private userDataService: UserDataService,
    private router: Router,
    private chatNotificationService: ChatNotificationService // Inietta il servizio di notifica
  ) { }

  ngOnInit() {
    this.isLoading = true;
    const auth = getAuth();

    this.authStateUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.loggedInUserId = user.uid;
        console.log('ChatListPage: Utente loggato ID:', this.loggedInUserId);
        this.loadUserConversations();
      } else {
        this.loggedInUserId = null;
        this.conversations = [];
        this.isLoading = false;
        console.log('ChatListPage: Nessun utente loggato, reindirizzo al login.');
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

  /**
   * Carica le conversazioni dell'utente loggato, arricchendole con i dettagli degli altri partecipanti
   * e calcolando lo stato dei messaggi non letti.
   */
  async loadUserConversations() {
    if (!this.loggedInUserId) {
      console.warn('ChatListPage: Impossibile caricare le conversazioni, loggedInUserId è nullo.');
      this.isLoading = false;
      return;
    }

    this.conversationsSubscription = this.chatService.getUserConversations(this.loggedInUserId)
      .pipe(
        switchMap((rawConvs: ConversationDocument[]) => {
          if (rawConvs.length === 0) {
            return of([]);
          }

          const extendedConvsObservables = rawConvs.map(conv => {
            const otherParticipantId = conv.participants.find(id => id !== this.loggedInUserId);

            const userProfileObservable = otherParticipantId
              ? from(this.userDataService.getUserDataById(otherParticipantId))
              : of(null);

            return userProfileObservable.pipe(
              map((otherUserData: UserProfile | null) => {
                const lastMessageAtDate = conv.lastMessageAt?.toDate();

                let hasUnread = false;
                let unreadCountForChat = 0; // Inizializza il contatore per la singola chat

                const lastReadByMe = conv.lastRead?.[this.loggedInUserId!];

                if (conv.lastMessageAt && (!lastReadByMe || lastReadByMe.toMillis() < conv.lastMessageAt.toMillis())) {
                  hasUnread = true;
                  unreadCountForChat = 1; // Imposta a 1 se c'è almeno un messaggio non letto
                }

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
                  hasUnreadMessages: hasUnread, // Questa proprietà è ancora utile per il global count
                  unreadMessageCount: unreadCountForChat // Assegna il conteggio (0 o 1)
                };

                // Aggiorna il conteggio globale nel servizio di notifica
                if (hasUnread) {
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
                  unreadMessageCount: 0 // Fallback
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
          console.log('ChatListPage: Conversazioni finali processate:', this.conversations);
        },
        error: (error) => {
          console.error('Errore nel recupero o elaborazione delle conversazioni:', error);
          this.isLoading = false;
        }
      });
  }

  openChat(conversationId: string) {
    this.router.navigate(['/chat', conversationId]);
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
    // La logica di base per determinare se ci sono messaggi non letti
    if (!this.loggedInUserId || !conversation.lastMessageAt) {
      return false;
    }

    const lastReadByMe = conversation.lastRead?.[this.loggedInUserId];

    return !lastReadByMe || (lastReadByMe instanceof Timestamp && conversation.lastMessageAt instanceof Timestamp && lastReadByMe.toMillis() < conversation.lastMessageAt.toMillis());
  }

  getDisplayLastMessage(conversation: ExtendedConversation): string {
    const prefix = this.isLastMessageFromMe(conversation) ? 'Io: ' : '';
    return prefix + (conversation.lastMessage || '');
  }

}
