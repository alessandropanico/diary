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
import { SearchModalComponent } from 'src/app/shared/search-modal/search-modal.component';

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

  private isSendingMessage: boolean = false;
  isModalOpen: boolean = false;

  editableName: string = '';
  editableDescription: string = '';
  // ⭐ Modifiche qui:
  // Non salviamo direttamente l'URL di preview per evitare confusione
  newPhotoFile: File | null = null; // Il file selezionato dall'utente
  // Usiamo un URL temporaneo per l'anteprima
  private previewPhotoUrl: string | null = null;

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
  ) { }

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
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      }
    });
  }

  async initializeGroupChat() {
    if (!this.isLoading) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }

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
        await this.loadInitialMessages();
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
        this.isLoading = false;
        this.cdr.detectChanges();
        if (this.currentUserId && this.groupId) {
          try {
            await this.updateLastReadTimestampInService();
          } catch (error) {
            console.error('Errore nel marcare i messaggi di gruppo come letti in ionViewWillEnter:', error);
          }
        }
      }
    }

    if (this.groupId) {
      this.groupChatNotificationService.setCurrentActiveGroupChat(this.groupId);
    }
  }

  async ionViewWillLeave() {
    this.groupDetailsSubscription?.unsubscribe();
    this.newMessagesListener?.unsubscribe();
    this.routeParamSubscription?.unsubscribe();

    if (this.currentUserId && this.groupId) {
      try {
        await this.updateLastReadTimestampInService();
      } catch (error) {
        console.error('Errore nel marcare i messaggi di gruppo come letti in ionViewWillLeave:', error);
      }
    }

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
    // ⭐ Reset delle variabili della modale
    this.editableName = '';
    this.editableDescription = '';
    this.newPhotoFile = null;
    this.previewPhotoUrl = null;
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

  private async loadInitialMessages() {
    if (!this.groupId) {
      console.warn('loadInitialMessages: Group ID not available, cannot load messages.');
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      const pagedData = await this.groupChatService.getInitialGroupMessages(this.groupId, this.messagesLimit);
      this.messages = pagedData.messages;
      this.lastVisibleMessageDoc = pagedData.lastVisibleDoc;
      this.hasMoreMessages = pagedData.hasMore;

      this.firstVisibleMessageTimestamp = this.messages.length > 0
        ? this.messages[this.messages.length - 1].timestamp
        : Timestamp.now();

      await this.updateLastReadTimestampInService();

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
    if (!this.newMessageText.trim() || !this.groupId || !this.currentUserId || this.isSendingMessage) {
      console.warn('sendMessage: Cannot send message: empty text, group ID, current user ID missing, or message already being sent.');
      return;
    }

    this.isSendingMessage = true;
    const messageToSend = this.newMessageText.trim();
    this.newMessageText = '';
    this.cdr.detectChanges();

    try {
      await this.groupChatService.sendMessage(this.groupId, this.currentUserId, messageToSend);
      if (this.currentUserId && this.groupId) {
        await this.updateLastReadTimestampInService();
      }
    } catch (error) {
      console.error('Errore durante l\'invio del messaggio di gruppo:', error);
      await this.presentFF7Alert('Impossibile inviare il messaggio di gruppo.');
      this.newMessageText = messageToSend;
    } finally {
      this.isSendingMessage = false;
      this.cdr.detectChanges();
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
    if (this.groupDetails) {
      this.editableName = this.groupDetails.name;
      this.editableDescription = this.groupDetails.description || '';
      // ⭐ Impostiamo l'URL di anteprima con l'URL corrente del gruppo
      this.previewPhotoUrl = this.groupDetails.photoUrl || '';
      // ⭐ Resettiamo il file selezionato
      this.newPhotoFile = null;
      this.isModalOpen = true;
      this.cdr.detectChanges();
    }
  }

  // ⭐ Metodo modificato per gestire la selezione del file
  async changeGroupPhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.click();

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        this.newPhotoFile = file;

        // Crea un'anteprima locale del file Base64
        const reader = new FileReader();
        reader.onload = () => {
          this.previewPhotoUrl = reader.result as string;
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      }
    };
  }

  // ⭐ Aggiungiamo un getter per l'immagine da visualizzare
  get photoToDisplay(): string {
    // Se c'è un'anteprima, usala, altrimenti usa quella del gruppo
    return this.previewPhotoUrl || this.groupDetails?.photoUrl || 'assets/img/default-group-photo.png';
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

  private async updateLastReadTimestampInService() {
    if (!this.groupId || !this.currentUserId) {
      console.warn('updateLastReadTimestampInService: Group ID or current user ID missing.');
      return;
    }

    try {
      const latestMessageTimestamp = this.messages.length > 0
        ? this.messages[this.messages.length - 1].timestamp
        : Timestamp.now();

      if (latestMessageTimestamp) {
        await this.groupChatService.markGroupMessagesAsRead(this.groupId, this.currentUserId, latestMessageTimestamp);
      }
    } catch (error) {
      console.error('Errore durante l\'aggiornamento del timestamp di ultima lettura:', error);
    }
  }

  onModalDismiss() {
    this.isModalOpen = false;
  }

  async openAddMembersModal() {
    if (this.groupInfoModal) {
      this.groupInfoModal.dismiss();
    }

    if (!this.groupDetails || !this.groupDetails.groupId) {
      await this.presentFF7Alert('Impossibile aggiungere membri: dettagli del gruppo mancanti.');
      return;
    }

    const existingMembers = this.groupDetails.members;

    const modal = await this.modalController.create({
      component: SearchModalComponent,
      componentProps: {
        existingMembers: existingMembers,
        isAddingToGroup: true
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();

    if (data && data.selectedUserIds && data.selectedUserIds.length > 0) {
      const newMembersIds = data.selectedUserIds;
      try {
        const addedMembersCount = await this.groupChatService.addMembersToGroup(this.groupDetails.groupId, newMembersIds);
        await this.presentFF7Alert(`${addedMembersCount} membri aggiunti con successo!`);
        await this.loadMemberNicknames();
        this.cdr.detectChanges();
      } catch (error) {
        console.error('Errore nell\'aggiungere membri al gruppo:', error);
        await this.presentFF7Alert('Errore nell\'aggiungere membri al gruppo. Riprova.');
      }
    }
  }

  // ⭐ Metodo saveGroupDetails modificato per salvare tutto insieme
  async saveGroupDetails() {
    if (!this.groupDetails || !this.groupId) {
      await this.presentFF7Alert('Impossibile salvare: dettagli del gruppo mancanti.');
      return;
    }

    const loadingAlert = await this.alertController.create({
        cssClass: 'ff7-alert',
        header: 'Salvataggio in corso...',
        message: 'Attendere prego.',
        backdropDismiss: false,
    });
    await loadingAlert.present();

    try {
      // 1. Aggiorna l'immagine se ne è stata selezionata una nuova
      if (this.newPhotoFile) {
        await this.groupChatService.updateGroupPhoto(this.groupId, this.newPhotoFile);
      }

      // 2. Aggiorna il nome e la descrizione
      const updates: Partial<GroupChat> = {
        name: this.editableName,
        description: this.editableDescription,
      };
      await this.groupChatService.updateGroupDetails(this.groupId, updates);

      await loadingAlert.dismiss();
      await this.presentFF7Alert('Dettagli del gruppo aggiornati con successo!');
      this.groupInfoModal.dismiss();

    } catch (error) {
      await loadingAlert.dismiss();
      console.error('Errore nel salvare i dettagli del gruppo:', error);
      await this.presentFF7Alert('Errore nel salvare i dettagli. Riprova.');
    }
  }
}
