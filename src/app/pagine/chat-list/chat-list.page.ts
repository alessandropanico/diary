import { Component, OnInit, OnDestroy, ViewChildren, QueryList } from '@angular/core';
import {
  ChatService,
  ConversationDocument,
  ExtendedConversation,
  UserProfile
} from 'src/app/services/chat.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Subscription, forkJoin, of, from, combineLatest, firstValueFrom, Observable } from 'rxjs';
import { map, switchMap, catchError, distinctUntilChanged } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ChatNotificationService } from 'src/app/services/chat-notification.service';
import { Timestamp } from 'firebase/firestore';
import { AlertController, IonItemSliding, ModalController, ViewWillEnter } from '@ionic/angular';
// Importa il nuovo servizio di presenza
import { PresenceService } from 'src/app/services/presence.service'; // <-- MODIFICA

import { SearchModalComponent } from 'src/app/shared/search-modal/search-modal.component';
import { GroupChatService, GroupChat } from 'src/app/services/group-chat.service';


import * as dayjs from 'dayjs';
import 'dayjs/locale/it';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import updateLocale from 'dayjs/plugin/updateLocale';
import relativeTime from 'dayjs/plugin/relativeTime';
import { GroupChatNotificationService } from 'src/app/services/group-chat-notification.service';

dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.extend(updateLocale);
dayjs.extend(relativeTime);
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

export interface ExtendedGroupChat extends GroupChat {
  hasUnreadMessages?: boolean;
  unreadMessageCount?: number;
}

export interface ChatListItem {
  id: string;
  type: 'private' | 'group';
  displayName: string;
  displayPhoto: string;
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  displayLastMessageAt: string;
  isLastMessageFromMe: boolean;
  hasUnreadMessages: boolean;
  unreadMessageCount: number;
  otherParticipantIsOnline?: boolean;
  otherParticipantLastOnline?: string;
  otherParticipantRawLastOnline?: string;

  groupDescription?: string;
}

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.page.html',
  styleUrls: ['./chat-list.page.scss'],
  standalone: false,
})
export class ChatListPage implements OnInit, OnDestroy, ViewWillEnter {

  conversations: ExtendedConversation[] = [];
  groupChats: ExtendedGroupChat[] = [];
  chatListItems: ChatListItem[] = [];

  loggedInUserId: string | null = null;
  isLoading: boolean = true;

  isSelectionMode: boolean = false;
  selectedConversations: Set<string> = new Set<string>();

  auth = getAuth();

  private authStateUnsubscribe: (() => void) | undefined;
  private conversationsSubscription: Subscription | undefined;
  private groupChatsSubscription: Subscription | undefined;
  private onlineStatusInterval: any;

  @ViewChildren(IonItemSliding) slidingItems!: QueryList<IonItemSliding>;

  constructor(
    private chatService: ChatService,
    private userDataService: UserDataService,
    private router: Router,
    private chatNotificationService: ChatNotificationService,
    private alertController: AlertController,
    private modalCtrl: ModalController,
    private groupChatService: GroupChatService,
    private presenceService: PresenceService,
    private groupChatNotificationService: GroupChatNotificationService, // ⭐ Aggiungi questo
    // <-- MODIFICA: Inietta il nuovo servizio
  ) { }

  ngOnInit() {
    this.isLoading = true;
    this.authStateUnsubscribe = onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.loggedInUserId = user.uid;
        this.presenceService.setPresence(); // <-- MODIFICA: Chiama il metodo per impostare la presenza
        this.loadAllChats();
      } else {
        this.loggedInUserId = null;
        this.conversations = [];
        this.groupChats = [];
        this.chatListItems = [];
        this.isLoading = false;
        this.router.navigateByUrl('/login');
        this.stopOnlineStatusCheck();
      }
    });
  }

  ionViewWillEnter() {
    this.isLoading = true;
    this.loadAllChats();
  }

  ngOnDestroy(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    if (this.conversationsSubscription) {
      this.conversationsSubscription.unsubscribe();
    }
    if (this.groupChatsSubscription) {
      this.groupChatsSubscription.unsubscribe();
    }
  }

  loadAllChats() {
    if (!this.loggedInUserId) {
      this.isLoading = false;
      return;
    }

    try {
      if (this.conversationsSubscription) {
        this.conversationsSubscription.unsubscribe();
      }

      const combinedChats$ = combineLatest([
        this.chatService.getUserConversations(this.loggedInUserId),
        this.groupChatService.getGroupsForUser(this.loggedInUserId)
      ]).pipe(
        switchMap(([rawConvs, rawGroups]) => {
          const filteredConvs = rawConvs.filter(conv =>
            !(conv.deletedBy && conv.deletedBy.includes(this.loggedInUserId!))
          );

          const allObservables = [
            ...filteredConvs.map(conv => this.processPrivateConversation(conv)),
            ...rawGroups.map(group => this.processGroupChat(group))
          ];

          if (allObservables.length === 0) {
            return of([]);
          }

          return forkJoin(allObservables);
        }),
        map(chatItems => {
          return chatItems.sort((a, b) => {
            const dateA = a.lastMessageAt ? a.lastMessageAt.toMillis() : 0;
            const dateB = b.lastMessageAt ? b.lastMessageAt.toMillis() : 0;
            return dateB - dateA;
          });
        })
      );

      this.conversationsSubscription = combinedChats$.subscribe({
        next: (chatItems: ChatListItem[]) => {
          this.chatListItems = chatItems;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Errore durante il caricamento delle chat:', error);
          this.isLoading = false;
        }
      });
    } catch (error) {
      console.error('Errore nel setup del caricamento delle chat:', error);
      this.isLoading = false;
    }
  }


  private async processPrivateConversation(conv: ConversationDocument): Promise<ChatListItem> {
    const otherParticipantId = conv.participants.find(id => id !== this.loggedInUserId);
    const otherUserData = otherParticipantId ? await firstValueFrom(from(this.userDataService.getUserDataById(otherParticipantId)).pipe(catchError(() => of(null)))) : null;
    const lastMessageAtDate = conv.lastMessageAt?.toDate();
    const lastReadByMe: Timestamp | null = conv.lastRead?.[this.loggedInUserId!] ?? null;
    const unreadCountForChat = await this.chatService.countUnreadMessages(conv.id, this.loggedInUserId!, lastReadByMe);
    const hasUnread = unreadCountForChat > 0;

    const { isOnline, lastOnlineDisplay } = this.getOnlineStatus(otherUserData?.lastOnline);

    if (hasUnread && !(conv.deletedBy && conv.deletedBy.includes(this.loggedInUserId!))) {
      this.chatNotificationService.incrementUnread(conv.id);
    } else {
      this.chatNotificationService.clearUnread(conv.id);
    }

    return {
      id: conv.id,
      type: 'private',
      displayName: otherUserData?.nickname || otherUserData?.name || 'Utente Sconosciuto',
      displayPhoto: otherUserData?.photo || 'assets/immaginiGenerali/default-avatar.jpg',
      lastMessage: conv.lastMessage || '',
      lastMessageAt: conv.lastMessageAt || null,
      displayLastMessageAt: lastMessageAtDate ? this.formatDate(lastMessageAtDate) : 'N/A',
      isLastMessageFromMe: conv.lastMessageSenderId === this.loggedInUserId,
      hasUnreadMessages: hasUnread,
      unreadMessageCount: unreadCountForChat,
      otherParticipantIsOnline: isOnline,
      otherParticipantLastOnline: lastOnlineDisplay,
      otherParticipantRawLastOnline: otherUserData?.lastOnline
    };
  }

  private async processGroupChat(group: GroupChat): Promise<ChatListItem> {
    if (!this.loggedInUserId) {
      return Promise.reject('Utente non autenticato');
    }

    // ⭐⭐ Corretto: Utilizza this.loggedInUserId ⭐⭐
    const unreadCountForGroup = await firstValueFrom<number>(
      this.groupChatNotificationService.getUnreadGroupCount(group.groupId!, this.loggedInUserId)
    );

    return {
      id: group.groupId!,
      type: 'group',
      displayName: group.name,
      displayPhoto: group.photoUrl || 'assets/immaginiGenerali/group-default-avatar.jpg',
      lastMessage: group.lastMessage?.text || '',
      lastMessageAt: group.lastMessage?.timestamp || null,
      displayLastMessageAt: group.lastMessage?.timestamp ? this.formatDate(group.lastMessage.timestamp.toDate()) : 'N/A',
      isLastMessageFromMe: group.lastMessage?.senderId === this.loggedInUserId,
      hasUnreadMessages: unreadCountForGroup > 0,
      unreadMessageCount: unreadCountForGroup,
      groupDescription: group.description || ''
    };
  }

  // Aggiungi questo metodo all'interno della classe GroupChatNotificationService
  public getUnreadGroupCount(groupId: string, currentUserId: string): Observable<number> {
    // Ora la variabile 'currentUserId' esiste perché è un parametro del metodo
    return this.groupChatService.getLastReadTimestamp(groupId, currentUserId).pipe(
      switchMap(lastReadTs => {
        const queryTimestamp = lastReadTs || new Timestamp(0, 0);
        return from(this.groupChatService.countUnreadMessagesForGroup(groupId, currentUserId, queryTimestamp));
      }),
      distinctUntilChanged(),
      catchError(err => {
        console.error(`Errore nel conteggio messaggi non letti per gruppo ${groupId}:`, err);
        return of(0);
      })
    );
  }

  private startOnlineStatusCheck() {
    if (this.onlineStatusInterval) {
      clearInterval(this.onlineStatusInterval);
    }
    this.onlineStatusInterval = setInterval(() => {
      this.syncOnlineStatus();
    }, 30000);
  }

  private stopOnlineStatusCheck() {
    if (this.onlineStatusInterval) {
      clearInterval(this.onlineStatusInterval);
      this.onlineStatusInterval = null;
    }
  }

  private syncOnlineStatus() {
    if (!this.chatListItems || this.chatListItems.length === 0) {
      return;
    }

    this.chatListItems = this.chatListItems.map(item => {
      if (item.type === 'private' && item.otherParticipantRawLastOnline) {
        const { isOnline, lastOnlineDisplay } = this.getOnlineStatus(item.otherParticipantRawLastOnline);
        return {
          ...item,
          otherParticipantIsOnline: isOnline,
          otherParticipantLastOnline: lastOnlineDisplay
        };
      }
      return item;
    });
  }

  getOnlineStatus(lastOnlineTimestamp: string | undefined): { isOnline: boolean, lastOnlineDisplay: string } {
    if (!lastOnlineTimestamp) {
      return { isOnline: false, lastOnlineDisplay: 'Offline' };
    }

    const lastOnline = dayjs(lastOnlineTimestamp);
    if (!lastOnline.isValid()) {
      return { isOnline: false, lastOnlineDisplay: 'Offline' };
    }

    const now = dayjs();
    const diffSeconds = now.diff(lastOnline, 'second');
    const isOnline = diffSeconds <= 60;

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

  openChat(item: ChatListItem) {
    if (!this.isSelectionMode) {
      if (item.type === 'private') {
        this.router.navigate(['/chat', item.id]);
      } else if (item.type === 'group') {
        this.router.navigate(['/chat-gruppo', item.id]);
      }
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

  isLastMessageFromMe(item: ChatListItem): boolean {
    return item.isLastMessageFromMe;
  }

  hasUnreadMessages(item: ChatListItem): boolean {
    return item.hasUnreadMessages;
  }

  getDisplayLastMessage(item: ChatListItem): string {
    const prefix = item.isLastMessageFromMe ? 'Tu: ' : '';
    return prefix + (item.lastMessage || '');
  }

  async deleteConversation(item: ChatListItem) {
    if (!this.loggedInUserId) {
      console.error('Errore: Utente non autenticato per eliminare la chat.');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Elimina Chat',
      message: `Sei sicuro di voler eliminare ${item.type === 'group' ? 'il gruppo' : 'la conversazione con'} ${item.displayName}?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina',
          handler: async () => {
            try {
              if (item.type === 'private') {
                await this.chatService.markConversationAsDeleted(item.id, this.loggedInUserId!);
              } else {
                await this.groupChatService.leaveGroup(item.id, this.loggedInUserId!);
              }
              this.chatNotificationService.clearUnread(item.id);
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
      message: `Sei sicuro di voler eliminare le ${this.selectedConversations.size} chat selezionate? Questa azione le rimuoverà dalla tua lista.`,
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
              const itemToDelete = this.chatListItems.find(item => item.id === convId);
              if (itemToDelete) {
                if (itemToDelete.type === 'private') {
                  deletePromises.push(this.chatService.markConversationAsDeleted(convId, this.loggedInUserId!));
                } else {
                  deletePromises.push(this.groupChatService.markGroupMessagesAsRead(convId, this.loggedInUserId!));
                  deletePromises.push(this.groupChatService.leaveGroup(convId, this.loggedInUserId!));
                }
                this.chatNotificationService.clearUnread(convId);
              }
            }

            try {
              await Promise.all(deletePromises);
              this.selectedConversations.clear();
              this.isSelectionMode = false;
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

  async openSearchUserModal() {
    const modal = await this.modalCtrl.create({
      component: SearchModalComponent,
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'backdrop') {
    } else if (data && data.selectedUserIds) {
      const selectedUserIds: string[] = data.selectedUserIds;

      if (!this.loggedInUserId) {
        console.warn('loggedInUserId non disponibile.');
        return;
      }

      if (selectedUserIds.length === 1) {
        const otherUserId = selectedUserIds[0];
        try {
          const conversationId = await this.chatService.getOrCreateConversation(this.loggedInUserId, otherUserId);
          this.router.navigate(['/chat', conversationId]);
        } catch (error) {
          console.error('Errore durante la creazione/ottenimento della conversazione 1-a-1:', error);
          const errorAlert = await this.alertController.create({
            header: 'Errore Chat',
            message: 'Impossibile avviare la chat 1-a-1 con l\'utente selezionato. Riprova.',
            buttons: ['OK'],
          });
          await errorAlert.present();
        }
      } else if (selectedUserIds.length > 1) {
        const allMembers = [this.loggedInUserId, ...selectedUserIds];

        const alert = await this.alertController.create({
          header: 'Crea Nuovo Gruppo',
          inputs: [
            {
              name: 'groupName',
              type: 'text',
              placeholder: 'Nome del gruppo (obbligatorio)',
            },
            {
              name: 'groupDescription',
              type: 'textarea',
              placeholder: 'Descrizione del gruppo (opzionale)',
            },
          ],
          buttons: [
            { text: 'Annulla', role: 'cancel' },
            {
              text: 'Crea',
              handler: async (alertData) => {
                const groupName = alertData.groupName.trim();
                const groupDescription = alertData.groupDescription.trim();

                if (!groupName) {
                  const nameRequiredAlert = await this.alertController.create({
                    header: 'Attenzione',
                    message: 'Il nome del gruppo è obbligatorio.',
                    buttons: ['OK'],
                  });
                  await nameRequiredAlert.present();
                  return false;
                }

                try {
                  const groupId = await this.groupChatService.createGroup(groupName, groupDescription, allMembers);
                  this.router.navigate(['/chat-gruppo', groupId]);
                  return true;
                } catch (error) {
                  console.error('Errore durante la creazione del gruppo:', error);
                  const errorAlert = await this.alertController.create({
                    header: 'Errore Gruppo',
                    message: 'Impossibile creare il gruppo. Riprova.',
                    buttons: ['OK'],
                  });
                  await errorAlert.present();
                  return true;
                }
              },
            },
          ],
        });
        await alert.present();

      } else {
        console.warn('Nessun utente selezionato dalla modale per avviare una chat o un gruppo.');
      }
    } else {
    }
  }

  async doRefresh(event: any) {
    this.isLoading = true;
    await this.loadAllChats();
    setTimeout(() => {
      event.target.complete();
    }, 100);
  }
}
