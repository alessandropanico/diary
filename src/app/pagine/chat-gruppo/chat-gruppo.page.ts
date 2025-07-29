// Nel tuo src/app/pages/chat-gruppo/chat-gruppo.page.ts

import { Component, OnInit, ViewChild, OnDestroy, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, InfiniteScrollCustomEvent, NavController, AlertController, ModalController } from '@ionic/angular';
import { getAuth } from 'firebase/auth';
import { Subscription } from 'rxjs';
import { GroupChatService, GroupChat, GroupMessage } from '../../services/group-chat.service';
import { UserDataService } from '../../services/user-data.service';
import * as dayjs from 'dayjs';
import { QueryDocumentSnapshot, Timestamp } from '@angular/fire/firestore';

import 'dayjs/locale/it';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import updateLocale from 'dayjs/plugin/updateLocale';

import { GroupChatNotificationService } from '../../services/group-chat-notification.service';

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
  selector: 'app-chat-gruppo',
  templateUrl: './chat-gruppo.page.html',
  styleUrls: ['./chat-gruppo.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatGruppoPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('groupInfoModal') groupInfoModal: any;

  groupId: string | null = null;
  currentUserId: string | null = null;
  groupDetails: GroupChat | null = null;
  messages: GroupMessage[] = [];
  newMessageText: string = '';
  isLoading: boolean = true;
  isLoadingMoreMessages: boolean = false;
  private lastVisibleMessageDoc: QueryDocumentSnapshot | null = null;
  private firstVisibleMessageTimestamp: Timestamp | null = null;
  private messagesLimit: number = 20;
  public hasMoreMessages: boolean = true;
  private initialScrollDone: boolean = false;
  showScrollToBottom: boolean = false;
  private lastScrollTop = 0;

  private auth = getAuth();
  private groupDetailsSubscription: Subscription | undefined;
  private newMessagesListener: Subscription | undefined;
  private routeParamSubscription: Subscription | undefined;
  private memberNicknamesMap: { [uid: string]: string } = {};

  constructor(
    private route: ActivatedRoute,
    private groupChatService: GroupChatService,
    private userDataService: UserDataService,
    private navCtrl: NavController,
    private router: Router,
    private alertController: AlertController,
    private modalController: ModalController,
    private cdr: ChangeDetectorRef,
    private groupChatNotificationService: GroupChatNotificationService
  ) {}

  ngOnInit() {
    this.currentUserId = this.auth.currentUser?.uid || null;

    if (!this.currentUserId) {
      console.warn('ngOnInit: No current user ID found. Redirecting to login.');
      this.presentFF7Alert('Devi essere loggato per visualizzare le chat di gruppo.')
        .then(() => this.router.navigateByUrl('/login'))
        .finally(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      return;
    }

    this.routeParamSubscription = this.route.paramMap.subscribe(params => {
      const newGroupId = params.get('id');
      if (this.groupId !== newGroupId) {
        this.groupId = newGroupId;
        if (this.groupId) {
          this.resetChatState();
          this.initializeGroupChat();
        } else {
          console.warn('ngOnInit: Group ID is null/undefined after route param update. Redirecting.');
          this.presentFF7Alert('ID del gruppo mancante. Reindirizzamento.').then(() => {
            this.router.navigateByUrl('/chat-list');
          });
        }
      }
    });
  }

  async initializeGroupChat() {
    this.isLoading = true;
    this.cdr.detectChanges();

    if (!this.currentUserId || !this.groupId) {
      console.warn('initializeGroupChat: Cannot initialize chat. User ID or Group ID missing.');
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.groupDetailsSubscription?.unsubscribe();
    this.groupDetailsSubscription = this.groupChatService.getGroupDetails(this.groupId).subscribe(
      async (group) => {
        this.groupDetails = group;
        this.cdr.detectChanges();

        if (!group) {
          console.error('groupDetailsSubscription: Group not found or inaccessible (null group object).');
          await this.presentFF7Alert('Gruppo non trovato o non accessibile.');
          this.router.navigateByUrl('/chat-list');
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }

        if (this.currentUserId && !this.groupDetails!.members.includes(this.currentUserId)) {
          console.warn('groupDetailsSubscription: Current user is not a member of this group. Redirecting.');
          await this.presentFF7Alert('Non sei un membro di questo gruppo.');
          this.router.navigateByUrl('/chat-list');
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }

        await this.loadMemberNicknames();
        await this.loadInitialMessagesAndSetupListener();
        // isLoading viene settato a false in loadInitialMessagesAndSetupListener, se tutto va bene
      },
      async (error) => {
        console.error('groupDetailsSubscription: Error loading group details:', error);
        await this.presentFF7Alert('Errore nel caricamento dei dettagli del gruppo.');
        this.router.navigateByUrl('/chat-list');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    );
  }

  async ionViewWillEnter() {
    if (!this.groupId) {
      // nothing to do
    } else {
      if (!this.groupDetailsSubscription || this.groupDetailsSubscription.closed) {
        this.resetChatState();
        this.initializeGroupChat();
      } else {
        // ⭐ CHIAMIAMO updateLastReadTimestampInService() QUI ⭐
        // Questo è il punto chiave per azzerare il contatore quando l'utente entra nella chat.
        if (this.currentUserId && this.groupId) {
          try {
            await this.updateLastReadTimestampInService(); // Chiamata al nuovo metodo (rinominato)
          } catch (error) {
            console.error('Errore nel marcare i messaggi di gruppo come letti in ionViewWillEnter:', error);
          }
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }

    // Notifica al servizio di notifica che la chat è attiva
    if (this.groupId) {
      this.groupChatNotificationService.setCurrentActiveGroupChat(this.groupId);
    }
  }

  async ionViewWillLeave() {
    this.groupDetailsSubscription?.unsubscribe();
    this.newMessagesListener?.unsubscribe();
    this.routeParamSubscription?.unsubscribe();

    // ⭐ CHIAMIAMO updateLastReadTimestampInService() QUI ANCHE QUANDO SI ESCE DALLA CHAT ⭐
    if (this.currentUserId && this.groupId) {
      try {
        await this.updateLastReadTimestampInService(); // Chiamata al nuovo metodo (rinominato)
      } catch (error) {
        console.error('Errore nel marcare i messaggi di gruppo come letti in ionViewWillLeave:', error);
      }
    }

    // Notifica al servizio di notifica che la chat non è più attiva
    this.groupChatNotificationService.setCurrentActiveGroupChat(null);
  }

  ngAfterViewInit() {
    this.observeScroll();
  }

  ngOnDestroy() {
    this.routeParamSubscription?.unsubscribe();
    this.groupDetailsSubscription?.unsubscribe();
    this.newMessagesListener?.unsubscribe();
  }

  private resetChatState() {
    this.messages = [];
    this.lastVisibleMessageDoc = null;
    this.firstVisibleMessageTimestamp = null;
    this.hasMoreMessages = true;
    this.isLoading = true;
    this.isLoadingMoreMessages = false;
    this.initialScrollDone = false;
    this.showScrollToBottom = false;
    this.lastScrollTop = 0;
    this.newMessageText = '';
    this.memberNicknamesMap = {};
  }

  private async loadMemberNicknames() {
    if (!this.groupDetails || !this.groupDetails.members) {
      console.warn('loadMemberNicknames: No group details or members found. Skipping nickname load.');
      return;
    }
    const memberIds = this.groupDetails.members.filter(id => id);

    const memberPromises = memberIds.map(async (memberId) => {
      try {
        const userData = await this.userDataService.getUserDataById(memberId);
        if (userData && userData['nickname']) {
          this.memberNicknamesMap[memberId] = userData['nickname'];
        } else {
          this.memberNicknamesMap[memberId] = 'Utente Sconosciuto';
          console.warn(`loadMemberNicknames: No nickname found for ${memberId}, set to 'Utente Sconosciuto'.`);
        }
      } catch (e) {
        console.error(`loadMemberNicknames: Error fetching user data for ${memberId}:`, e);
        this.memberNicknamesMap[memberId] = 'Utente Sconosciuto (Errore)';
      }
    });
    await Promise.all(memberPromises);
    this.cdr.detectChanges();
  }

  getMemberDisplay(memberId: string): string {
    if (memberId === this.currentUserId) {
      return `${this.memberNicknamesMap[memberId] || memberId} (Tu)`;
    }
    return this.memberNicknamesMap[memberId] || memberId;
  }

  private async loadInitialMessagesAndSetupListener() {
    if (!this.groupId) {
      console.warn('loadInitialMessagesAndSetupListener: Group ID not available, cannot load messages.');
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    try {
      const pagedData = await this.groupChatService.getInitialGroupMessages(this.groupId, this.messagesLimit);
      this.messages = pagedData.messages;
      this.lastVisibleMessageDoc = pagedData.lastVisibleDoc;
      this.hasMoreMessages = pagedData.hasMore;

      if (this.messages.length > 0) {
        this.firstVisibleMessageTimestamp = this.messages[this.messages.length - 1].timestamp;

        // ⭐ AGGIORNAMENTO ULTIMA LETTURA QUI DOPO AVER CARICATO I MESSAGGI ⭐
        await this.updateLastReadTimestampInService();
      } else {
        this.firstVisibleMessageTimestamp = Timestamp.now();
      }

      this.isLoading = false;
      this.cdr.detectChanges();

      this.setupNewMessagesListener();

      setTimeout(async () => {
        await this.scrollToBottom(0);
        this.initialScrollDone = true;
        this.cdr.detectChanges();
      }, 50);

    } catch (error) {
      console.error('Errore nel recupero dei messaggi iniziali del gruppo:', error);
      await this.presentFF7Alert('Errore nel caricamento dei messaggi del gruppo.');
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private setupNewMessagesListener() {
    this.newMessagesListener?.unsubscribe();
    if (!this.groupId || !this.firstVisibleMessageTimestamp) {
      console.warn('setupNewMessagesListener: Cannot set up listener, Group ID or firstVisibleMessageTimestamp missing.');
      return;
    }

    this.newMessagesListener = this.groupChatService.getNewGroupMessages(this.groupId, this.firstVisibleMessageTimestamp).subscribe(
      async (newIncomingMessages: GroupMessage[]) => {
        if (newIncomingMessages.length > 0) {
          const wasAtBottomBeforeUpdate = await this.isUserNearBottomCheckNeeded();

          const existingMessageIds = new Set(this.messages.map(m => m.messageId));
          const uniqueNewMessages = newIncomingMessages.filter(msg => msg.messageId && !existingMessageIds.has(msg.messageId));

          if (uniqueNewMessages.length > 0) {
            this.messages = [...this.messages, ...uniqueNewMessages].sort((a, b) => {
              const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
              const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
              return timeA - timeB;
            });
            this.cdr.detectChanges();

            this.firstVisibleMessageTimestamp = this.messages[this.messages.length - 1].timestamp;

            if (wasAtBottomBeforeUpdate) {
              setTimeout(() => this.scrollToBottom(300), 50);
            } else {
              this.showScrollToBottom = true;
            }

            // ⭐ AGGIORNAMENTO ULTIMA LETTURA QUANDO ARRIVANO NUOVI MESSAGGI ⭐
            if (wasAtBottomBeforeUpdate && this.currentUserId && this.groupId) {
                 await this.updateLastReadTimestampInService();
            }
          }
        }
      },
      (error) => {
        console.error('Errore nel listener dei nuovi messaggi:', error);
        this.presentFF7Alert('Errore nel ricevere nuovi messaggi.');
      }
    );
  }

  private async isUserNearBottomCheckNeeded(): Promise<boolean> {
    if (!this.content) return true;
    const scrollElement = await this.content.getScrollElement();
    const scrollHeight = scrollElement.scrollHeight;
    const scrollTop = scrollElement.scrollTop;
    const clientHeight = scrollElement.clientHeight;
    const threshold = 100;
    return (scrollHeight - scrollTop - clientHeight) < threshold;
  }

  observeScroll() {
    if (!this.content) return;
    this.content.ionScroll.subscribe(async (event) => {
      const scrollElement = await this.content.getScrollElement();
      const currentScrollTop = event.detail.scrollTop;
      const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;

      const threshold = 100;
      const isAtBottom = (maxScrollTop - currentScrollTop) < threshold;
      const isScrollingUp = currentScrollTop < this.lastScrollTop;

      if (isScrollingUp && !isAtBottom) {
        this.showScrollToBottom = true;
      } else if (isAtBottom) {
        this.showScrollToBottom = false;
        // ⭐ QUANDO L'UTENTE SCORRE FINO IN FONDO, SEGNA I MESSAGGI COME LETTI ⭐
        if (this.currentUserId && this.groupId) {
          await this.updateLastReadTimestampInService();
        }
      }

      this.lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop;
      this.cdr.detectChanges();
    });
  }

  async loadMoreMessages(event: InfiniteScrollCustomEvent) {
    if (!this.hasMoreMessages || this.isLoadingMoreMessages || !this.groupId || !this.lastVisibleMessageDoc) {
      event.target.complete();
      return;
    }

    this.isLoadingMoreMessages = true;

    try {
      const scrollElement = await this.content.getScrollElement();
      const oldScrollHeight = scrollElement.scrollHeight;

      const pagedData = await this.groupChatService.getOlderGroupMessages(this.groupId, this.messagesLimit, this.lastVisibleMessageDoc);

      const newMessages = pagedData.messages;
      const newLastVisibleDoc = pagedData.lastVisibleDoc;
      const newHasMore = pagedData.hasMore;

      const existingMessageIds = new Set(this.messages.map(m => m.messageId));
      const uniqueNewMessages = newMessages.filter(msg => msg.messageId && !existingMessageIds.has(msg.messageId));

      if (uniqueNewMessages.length > 0) {
        this.messages = [...uniqueNewMessages, ...this.messages];
        this.lastVisibleMessageDoc = newLastVisibleDoc;
        this.hasMoreMessages = newHasMore;
        this.cdr.detectChanges();

        await this.content.getScrollElement().then(newEl => {
          this.content.scrollToPoint(0, newEl.scrollHeight - oldScrollHeight, 0);
        });
      } else {
        this.hasMoreMessages = false;
      }

      this.isLoadingMoreMessages = false;
      event.target.complete();

    } catch (error) {
      console.error('Errore nel caricamento di più messaggi del gruppo:', error);
      await this.presentFF7Alert('Errore nel caricamento di più messaggi del gruppo.');
      this.isLoadingMoreMessages = false;
      event.target.complete();
    }
  }

  async sendMessage() {
    if (!this.newMessageText.trim() || !this.groupId || !this.currentUserId) {
      console.warn('sendMessage: Cannot send message: empty text, group ID, or current user ID missing.');
      return;
    }

    try {
      await this.groupChatService.sendMessage(this.groupId, this.currentUserId, this.newMessageText.trim());
      this.newMessageText = '';
      this.cdr.detectChanges();
      setTimeout(() => this.scrollToBottom(), 50);

      // ⭐ AGGIORNAMENTO ULTIMA LETTURA DOPO AVER INVIATO UN MESSAGGIO ⭐
      if (this.currentUserId && this.groupId) {
        await this.updateLastReadTimestampInService();
      }

    } catch (error) {
      console.error('Errore durante l\'invio del messaggio di gruppo:', error);
      await this.presentFF7Alert('Impossibile inviare il messaggio di gruppo.');
    }
  }

  async scrollToBottom(duration: number = 300) {
    if (this.content) {
      await this.content.scrollToBottom(duration);
    }
  }

  isMyMessage(senderId: string): boolean {
    return senderId === this.currentUserId;
  }

  shouldShowDate(message: GroupMessage, index: number): boolean {
    if (!message || !message.timestamp) {
      return false;
    }
    if (index === 0) {
      return true;
    }
    const currentMessageDate = dayjs(message.timestamp.toDate()).startOf('day');
    const previousMessage = this.messages[index - 1];
    if (!previousMessage || !previousMessage.timestamp) {
      return true;
    }
    const previousMessageDate = dayjs(previousMessage.timestamp.toDate()).startOf('day');
    return !currentMessageDate.isSame(previousMessageDate, 'day');
  }

  formatDateHeader(timestamp: Timestamp): string {
    const d = dayjs(timestamp.toDate());
    const today = dayjs().startOf('day');
    const yesterday = dayjs().subtract(1, 'day').startOf('day');
    const messageDate = d.startOf('day');

    if (messageDate.isSame(today, 'day')) {
      return 'Oggi';
    } else if (messageDate.isSame(yesterday, 'day')) {
      return 'Ieri';
    } else {
      return d.format('DD MMMM YYYY');
    }
  }

  async presentFF7Alert(message: string) {
    const alert = await this.alertController.create({
      cssClass: 'ff7-alert',
      header: 'Attenzione',
      message,
      buttons: [
        {
          text: 'OK',
          cssClass: 'ff7-alert-button',
          role: 'cancel'
        }
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }

  async presentGroupInfoModal() {
    if (!this.groupDetails) {
      console.warn('presentGroupInfoModal: Group details not available. Cannot open modal.');
      await this.presentFF7Alert('Dettagli del gruppo non disponibili.');
      return;
    }
    if (this.groupInfoModal) {
      await this.groupInfoModal.present();
    } else {
      console.error('presentGroupInfoModal: groupInfoModal reference is null/undefined. This might be due to a timing issue if the modal is not yet rendered.');
    }
  }

  async confirmLeaveGroup() {
    if (this.groupInfoModal) {
      await this.groupInfoModal.dismiss();
    }

    const alert = await this.alertController.create({
      cssClass: 'ff7-alert',
      header: 'Attenzione',
      message: 'Sei sicuro di voler abbandonare questo gruppo? Non potrai più vedere i messaggi passati.',
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel',
          cssClass: 'ff7-alert-button'
        },
        {
          text: 'Abbandona',
          cssClass: 'ff7-alert-button',
          handler: async () => {
            if (this.groupId && this.currentUserId) {
              try {
                await this.groupChatService.leaveGroup(this.groupId, this.currentUserId);
                await this.presentFF7Alert('Hai abbandonato il gruppo con successo.');
                this.router.navigateByUrl('/chat-list');
              } catch (error) {
                console.error('Errore nell\'abbandonare il gruppo:', error);
                await this.presentFF7Alert('Errore nell\'abbandonare il gruppo. Riprova.');
              }
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ⭐ NUOVO METODO: Incaricato di aggiornare il timestamp dell'ultima lettura nel servizio ⭐
  private async updateLastReadTimestampInService() {
    if (!this.groupId || !this.currentUserId) {
      console.warn('updateLastReadTimestampInService: Group ID or current user ID missing.');
      return;
    }

    try {
      // Ottieni il timestamp dell'ultimo messaggio attualmente visualizzato nella chat
      // Se non ci sono messaggi, usa il timestamp corrente.
      const latestMessageTimestamp = this.messages.length > 0
                                     ? this.messages[this.messages.length - 1].timestamp
                                     : Timestamp.now();

      if (latestMessageTimestamp) {
        // Chiama il metodo markGroupMessagesAsRead del servizio, passandogli il timestamp specifico
        await this.groupChatService.markGroupMessagesAsRead(this.groupId, this.currentUserId, latestMessageTimestamp);
        // console.log(`Last read timestamp updated for group ${this.groupId} by user ${this.currentUserId}`);
      }
    } catch (error) {
      console.error('Errore durante l\'aggiornamento del timestamp di ultima lettura:', error);
    }
  }
}
