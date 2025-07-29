import { Component, OnInit, OnDestroy, ViewChildren, QueryList } from '@angular/core';
import {
  ChatService,
  ConversationDocument,
  ExtendedConversation,
  UserProfile
} from 'src/app/services/chat.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Subscription, forkJoin, of, from, combineLatest, firstValueFrom } from 'rxjs'; // ⭐ AGGIUNTO firstValueFrom
import { map, switchMap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ChatNotificationService } from 'src/app/services/chat-notification.service';
import { Timestamp } from 'firebase/firestore';
import { AlertController, IonItemSliding, ModalController } from '@ionic/angular';

import { SearchModalComponent } from 'src/app/shared/search-modal/search-modal.component';
import { GroupChatService, GroupChat } from 'src/app/services/group-chat.service';


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
  groupDescription?: string;
}

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.page.html',
  styleUrls: ['./chat-list.page.scss'],
  standalone: false,
})
export class ChatListPage implements OnInit, OnDestroy {

  conversations: ExtendedConversation[] = [];
  groupChats: ExtendedGroupChat[] = [];
  chatListItems: ChatListItem[] = [];

  loggedInUserId: string | null = null;
  isLoading: boolean = true; // Inizializzato a true

  isSelectionMode: boolean = false;
  selectedConversations: Set<string> = new Set<string>();

  private isConversationsLoaded: boolean = false;
  private isGroupChatsLoaded: boolean = false;

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
    private groupChatService: GroupChatService
  ) { }

  ngOnInit() {
    this.isLoading = true; // ⭐ Assicurati che isLoading sia true all'inizio ⭐
    this.isConversationsLoaded = false;
    this.isGroupChatsLoaded = false;

    this.authStateUnsubscribe = onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.loggedInUserId = user.uid;
        // ⭐ Chiamiamo i caricamenti e li avvolgiamo in Promise per `doRefresh` ⭐
        this.loadUserConversations();
        this.loadUserGroupChats();
        this.startOnlineStatusCheck();
      } else {
        this.loggedInUserId = null;
        this.conversations = [];
        this.groupChats = [];
        this.chatListItems = [];
        this.isLoading = false; // Se non loggato, imposta isLoading a false
        this.router.navigateByUrl('/login');
        this.stopOnlineStatusCheck();
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
    if (this.groupChatsSubscription) {
      this.groupChatsSubscription.unsubscribe();
    }
    this.stopOnlineStatusCheck();
  }

  // Modificato per restituire una Promise che risolve quando il caricamento è completato
  loadUserConversations(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.loggedInUserId) {
        console.warn('ChatListPage: Impossibile caricare le conversazioni, loggedInUserId è nullo.');
        this.isConversationsLoaded = true;
        this.checkAllChatsLoaded();
        resolve(); // Risolve la Promise
        return;
      }

      if (this.conversationsSubscription) {
        this.conversationsSubscription.unsubscribe();
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
            this.conversations = processedConvs;
            this.isConversationsLoaded = true;
            this.checkAllChatsLoaded();
            resolve(); // ⭐ Risolve la Promise qui ⭐
          },
          error: (error) => {
            console.error('Errore nel recupero o elaborazione delle conversazioni:', error);
            this.isConversationsLoaded = true;
            this.checkAllChatsLoaded();
            resolve(); // ⭐ Risolve la Promise anche in caso di errore ⭐
          }
        });
    });
  }

  // Modificato per restituire una Promise che risolve quando il caricamento è completato
  loadUserGroupChats(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.loggedInUserId) {
        console.warn('ChatListPage: Impossibile caricare i gruppi, loggedInUserId è nullo.');
        this.isGroupChatsLoaded = true;
        this.checkAllChatsLoaded();
        resolve(); // Risolve la Promise
        return;
      }

      if (this.groupChatsSubscription) {
        this.groupChatsSubscription.unsubscribe();
      }

      this.groupChatsSubscription = this.groupChatService.getGroupsForUser(this.loggedInUserId).subscribe({
        next: async (groups: GroupChat[]) => {

          const processedGroups: ExtendedGroupChat[] = await Promise.all(groups.map(async group => {
            // ⭐ Usiamo firstValueFrom per convertire l'Observable in una Promise ⭐
            const lastReadTimestamp = await firstValueFrom(this.groupChatService.getLastReadTimestamp(group.groupId!, this.loggedInUserId!)).catch(() => null);

            const unreadCountForGroup = await this.groupChatService.countUnreadMessagesForGroup(
              group.groupId!,
              this.loggedInUserId!,
              lastReadTimestamp
            );

            const extendedGroup: ExtendedGroupChat = {
              ...group,
              unreadMessageCount: unreadCountForGroup,
              hasUnreadMessages: unreadCountForGroup > 0
            };
            return extendedGroup;
          }));

          this.groupChats = processedGroups;
          this.isGroupChatsLoaded = true;
          this.checkAllChatsLoaded();
          resolve(); // ⭐ Risolve la Promise qui ⭐
        },
        error: (error) => {
          console.error('Errore nel recupero dei gruppi di chat:', error);
          this.isGroupChatsLoaded = true;
          this.checkAllChatsLoaded();
          resolve(); // ⭐ Risolve la Promise anche in caso di errore ⭐
        }
      });
    });
  }

  private checkAllChatsLoaded() {
    if (this.isConversationsLoaded && this.isGroupChatsLoaded) {
      this.updateCombinedChatList();
      this.isLoading = false;
    }
  }

  private updateCombinedChatList() {
    const combined: ChatListItem[] = [];

    this.conversations.forEach(conv => {
      combined.push({
        id: conv.id,
        type: 'private',
        displayName: conv.otherParticipantName,
        displayPhoto: conv.otherParticipantPhoto,
        lastMessage: conv.lastMessage || '',
        lastMessageAt: conv.lastMessageAt || null,
        displayLastMessageAt: conv.displayLastMessageAt,
        isLastMessageFromMe: conv.lastMessageSenderId === this.loggedInUserId,
        hasUnreadMessages: conv.hasUnreadMessages ?? false,
        unreadMessageCount: conv.unreadMessageCount ?? 0,
        otherParticipantIsOnline: conv.otherParticipantIsOnline,
        otherParticipantLastOnline: conv.otherParticipantLastOnline
      });
    });

    this.groupChats.forEach(group => {
      combined.push({
        id: group.groupId!,
        type: 'group',
        displayName: group.name,
        displayPhoto: group.photoUrl || 'assets/immaginiGenerali/group-default-avatar.jpg',
        lastMessage: group.lastMessage?.text || '',
        lastMessageAt: group.lastMessage?.timestamp || null,
        displayLastMessageAt: group.lastMessage?.timestamp ? this.formatDate(group.lastMessage.timestamp.toDate()) : 'N/A',
        isLastMessageFromMe: group.lastMessage?.senderId === this.loggedInUserId,
        hasUnreadMessages: group.hasUnreadMessages ?? false,
        unreadMessageCount: group.unreadMessageCount ?? 0,
        groupDescription: group.description || ''
      });
    });

    this.chatListItems = combined.sort((a, b) => {
      const dateA = a.lastMessageAt ? a.lastMessageAt.toMillis() : 0;
      const dateB = b.lastMessageAt ? b.lastMessageAt.toMillis() : 0;
      return dateB - dateA;
    });

    this.updateOnlineStatusForConversations();
  }

  private startOnlineStatusCheck() {
    this.onlineStatusInterval = setInterval(() => {
      this.updateOnlineStatusForConversations();
    }, 30000);
  }

  private stopOnlineStatusCheck() {
    if (this.onlineStatusInterval) {
      clearInterval(this.onlineStatusInterval);
      this.onlineStatusInterval = null;
    }
  }

  private updateOnlineStatusForConversations() {
    if (this.chatListItems && this.chatListItems.length > 0) {
      this.chatListItems = this.chatListItems.map(item => {
        if (item.type === 'private' && item.otherParticipantLastOnline) {
          const { isOnline, lastOnlineDisplay } = this.getOnlineStatus(item.otherParticipantLastOnline);
          return {
            ...item,
            otherParticipantIsOnline: isOnline,
            otherParticipantLastOnline: lastOnlineDisplay
          };
        }
        return item;
      });
    }
  }

  getOnlineStatus(lastOnlineTimestamp: string | undefined): { isOnline: boolean, lastOnlineDisplay: string } {
    if (!lastOnlineTimestamp) {
      return { isOnline: false, lastOnlineDisplay: 'Offline' };
    }

    const lastOnline = dayjs(lastOnlineTimestamp);
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
    this.isLoading = true; // Mostra spinner durante il refresh
    this.isConversationsLoaded = false; // Reset dei flag
    this.isGroupChatsLoaded = false;

    // Avvia i caricamenti. I metodi ora restituiscono Promise.
    await Promise.all([
      this.loadUserConversations(),
      this.loadUserGroupChats()
    ]);

    // checkAllChatsLoaded() verrà chiamato automaticamente alla risoluzione di entrambi i caricamenti.
    // Una volta che checkAllChatsLoaded() avrà impostato isLoading = false e aggiornato la lista,
    // potremo completare il refresher.
    // Per assicurare che il refresher si fermi DOPO che tutti i dati sono stati elaborati e this.isLoading è false
    // possiamo usare un piccolo setTimeout o legarci a un Observable, ma per semplicità diretta:
    // Ci affidiamo al fatto che checkAllChatsLoaded imposti isLoading a false.
    // Quindi, un piccolo ritardo per permettere al ciclo di rilevamento cambiamenti di Angular
    // di aggiornare la UI prima di chiudere il refresher.
    // Oppure, meglio, agganciarsi a un meccanismo che segnali il completamento della UI (non solo del dato).
    // Per ora, lo lasciamo come era, ma il fatto che loadUserConversations e loadUserGroupChats
    // restituiscano Promise lo rende più corretto per `Promise.all`.

    // Considera di chiamare event.target.complete() solo dopo che isLoading è diventato false,
    // il che significa che `updateCombinedChatList` è stato chiamato.
    // Dato che non abbiamo un Observable di `isLoading` per fare pipe, un approccio più semplice
    // è completare il refresher dopo un breve ritardo, assicurando che la UI abbia avuto tempo di aggiornarsi.
    setTimeout(() => {
        event.target.complete();
    }, 100); // Piccolo ritardo per UI update
  }
}
