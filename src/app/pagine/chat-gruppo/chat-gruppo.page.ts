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
    private cdr: ChangeDetectorRef
  ) {
    console.log('⭐⭐⭐ ChatGruppoPage Constructor Called ⭐⭐⭐');
  }

  ngOnInit() {
    console.log('ngOnInit: started.');
    this.currentUserId = this.auth.currentUser?.uid || null;
    console.log('ngOnInit: Current User ID:', this.currentUserId);

    if (!this.currentUserId) {
      console.warn('ngOnInit: No current user ID found. Redirecting to login.');
      this.presentFF7Alert('Devi essere loggato per visualizzare le chat di gruppo.')
        .then(() => this.router.navigateByUrl('/login'))
        .finally(() => {
          this.isLoading = false;
          this.cdr.detectChanges(); // Assicura che la UI si aggiorni in caso di reindirizzamento
        });
      return;
    }

    this.routeParamSubscription = this.route.paramMap.subscribe(params => {
      const newGroupId = params.get('id');
      console.log('ngOnInit: Route paramMap subscription received new ID:', newGroupId);
      if (this.groupId !== newGroupId) {
        this.groupId = newGroupId;
        console.log('ngOnInit: Group ID updated to:', this.groupId);
        // ⭐ Chiamata esplicita a resetChatState e logica di caricamento qui ⭐
        // Questo è il cambiamento chiave. Se ionViewWillEnter non parte,
        // almeno questa parte del codice si occupa dell'inizializzazione quando il parametro cambia.
        if (this.groupId) {
          console.log('ngOnInit: Group ID changed. Resetting and loading chat state.');
          this.resetChatState();
          this.initializeGroupChat(); // Funzione che raggruppa la logica di ionViewWillEnter
        } else {
          console.warn('ngOnInit: Group ID is null/undefined after route param update. Redirecting.');
          this.presentFF7Alert('ID del gruppo mancante. Reindirizzamento.').then(() => {
            this.router.navigateByUrl('/chat-list');
          });
        }
      }
    });
    console.log('ngOnInit: finished.');
  }

  // ⭐ Ho spostato la logica principale di ionViewWillEnter qui per poterla chiamare anche da ngOnInit ⭐
  async initializeGroupChat() {
    console.log('initializeGroupChat: Starting initialization for group.');
    this.isLoading = true; // Inizia il caricamento
    this.cdr.detectChanges(); // Aggiorna la vista per mostrare lo spinner

    if (!this.currentUserId || !this.groupId) {
      console.warn('initializeGroupChat: Cannot initialize chat. User ID or Group ID missing.');
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.groupDetailsSubscription?.unsubscribe();
    this.groupDetailsSubscription = this.groupChatService.getGroupDetails(this.groupId).subscribe(
      async (group) => {
        console.log('groupDetailsSubscription: Received group data:', group);
        this.groupDetails = group;
        this.cdr.detectChanges(); // Aggiorna subito i dettagli del gruppo

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

        console.log('groupDetailsSubscription: Group details valid. Loading member nicknames and initial messages.');
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
    console.log('initializeGroupChat: Finished setting up subscriptions.');
  }


  async ionViewWillEnter() {
    console.log('⭐⭐⭐ ionViewWillEnter: Initializing chat page for group. ⭐⭐⭐');
    // Se groupId è già stato impostato da ngOnInit, la logica di initializeGroupChat sarà già partita.
    // Altrimenti, la chiamiamo qui. Questo gestisce sia il primo carico che i ritorni alla pagina.
    if (!this.groupId) { // Solo se il groupId non è ancora stato impostato
      console.log('ionViewWillEnter: Group ID not yet set, relying on paramMap subscription in ngOnInit.');
      // La logica di setup sarà gestita dal subscription di paramMap in ngOnInit
      // In scenari standard di navigazione, ionViewWillEnter viene chiamato *dopo* ngOnInit
      // e il paramMap subscription avrà già fornito l'ID.
      // Se il groupId è già impostato, significa che ngOnInit ha già innescato initializeGroupChat.
    } else {
      console.log('ionViewWillEnter: Group ID already set. Ensuring chat state is correct.');
      // Se si torna indietro alla pagina, assicuriamoci che lo stato sia pulito e i listener aggiornati.
      // Non c'è bisogno di chiamare initializeGroupChat di nuovo se i listener sono già attivi.
      // Se il gruppo è lo stesso, semplicemente resetta lo stato e controlla i listener.
      // Se invece si cambia gruppo (e questo non è il primo accesso), ngOnInit avrà già chiamato initializeGroupChat.
      // Quindi, qui è più un controllo di pulizia e stato.
      if (!this.groupDetailsSubscription || this.groupDetailsSubscription.closed) {
        console.log('ionViewWillEnter: Group details subscription is not active, re-initializing chat.');
        this.resetChatState();
        this.initializeGroupChat();
      } else {
        console.log('ionViewWillEnter: Group details subscription already active.');
        // Potresti voler solo aggiornare i messaggi letti qui se non c'è un reset completo
        if (this.currentUserId && this.groupId) {
          try {
            await this.groupChatService.markGroupMessagesAsRead(this.groupId, this.currentUserId);
            console.log(`ionViewWillEnter: Messages marked as read for group ${this.groupId} by user ${this.currentUserId}.`);
          } catch (error) {
            console.error('Errore nel marcare i messaggi di gruppo come letti in ionViewWillEnter:', error);
          }
        }
        this.isLoading = false; // Se la chat è già caricata
        this.cdr.detectChanges();
      }
    }
  }

  async ionViewWillLeave() {
    console.log('ionViewWillLeave: Cleaning up listeners and marking messages as read.');
    this.groupDetailsSubscription?.unsubscribe();
    this.newMessagesListener?.unsubscribe();
    this.routeParamSubscription?.unsubscribe(); // Assicurati di disiscriverti qui

    if (this.currentUserId && this.groupId) {
      try {
        await this.groupChatService.markGroupMessagesAsRead(this.groupId, this.currentUserId);
        console.log(`ionViewWillLeave: Messages marked as read for group ${this.groupId} by user ${this.currentUserId}.`);
      } catch (error) {
        console.error('Errore nel marcare i messaggi di gruppo come letti in ionViewWillLeave:', error);
      }
    }
  }

  ngAfterViewInit() {
    console.log('ngAfterViewInit: Observing scroll.');
    this.observeScroll();
  }

  ngOnDestroy() {
    console.log('ngOnDestroy: Final component cleanup.');
    this.routeParamSubscription?.unsubscribe();
    this.groupDetailsSubscription?.unsubscribe();
    this.newMessagesListener?.unsubscribe();
  }

  /**
   * Resetta lo stato della chat quando si cambia gruppo o si ricarica.
   */
  private resetChatState() {
    console.log('resetChatState: Resetting chat state...');
    this.messages = [];
    this.lastVisibleMessageDoc = null;
    this.firstVisibleMessageTimestamp = null;
    this.hasMoreMessages = true;
    this.isLoading = true; // ⭐ Assicurati che isLoading sia TRUE all'inizio ⭐
    this.isLoadingMoreMessages = false;
    this.initialScrollDone = false;
    this.showScrollToBottom = false;
    this.lastScrollTop = 0;
    this.newMessageText = '';
    this.memberNicknamesMap = {};
    // this.cdr.detectChanges(); // Rimosso qui, sarà chiamato da initializeGroupChat o ngOnInit
    console.log('resetChatState: Chat state reset.');
  }

  /**
   * Carica i nickname di tutti i membri del gruppo per visualizzarli nel popover/modal.
   */
  private async loadMemberNicknames() {
    console.log('loadMemberNicknames: Starting to load member nicknames.');
    if (!this.groupDetails || !this.groupDetails.members) {
      console.warn('loadMemberNicknames: No group details or members found. Skipping nickname load.');
      return;
    }
    const memberIds = this.groupDetails.members.filter(id => id); // Filter out null/undefined IDs

    const memberPromises = memberIds.map(async (memberId) => {
      try {
        const userData = await this.userDataService.getUserDataById(memberId);
        if (userData && userData['nickname']) {
          this.memberNicknamesMap[memberId] = userData['nickname'];
          console.log(`loadMemberNicknames: Loaded nickname for ${memberId}: ${userData['nickname']}`);
        } else {
          this.memberNicknamesMap[memberId] = 'Utente Sconosciuto';
          console.warn(`loadMemberNicknames: No nickname found for ${memberId}, set to 'Utente Sconosciuto'.`);
        }
      } catch (e) {
        console.error(`loadMemberNicknames: Error fetching user data for ${memberId}:`, e);
        this.memberNicknamesMap[memberId] = 'Utente Sconosciuto (Errore)'; // Fallback in case of error
      }
    });
    await Promise.all(memberPromises);
    this.cdr.detectChanges();
    console.log('loadMemberNicknames: All nicknames loaded. Map:', this.memberNicknamesMap);
  }

  /**
   * Restituisce il nickname di un membro o un fallback.
   * Usato nel template della modal.
   */
  getMemberDisplay(memberId: string): string {
    if (memberId === this.currentUserId) {
      return `${this.memberNicknamesMap[memberId] || memberId} (Tu)`;
    }
    return this.memberNicknamesMap[memberId] || memberId;
  }

  /**
   * Carica i messaggi iniziali e imposta un listener per i nuovi messaggi.
   */
  private async loadInitialMessagesAndSetupListener() {
    console.log('loadInitialMessagesAndSetupListener: Starting to load initial messages.');
    if (!this.groupId) {
      console.warn('loadInitialMessagesAndSetupListener: Group ID not available, cannot load messages.');
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    try {
      console.log(`loadInitialMessagesAndSetupListener: Calling getInitialGroupMessages for group ${this.groupId}.`);
      const pagedData = await this.groupChatService.getInitialGroupMessages(this.groupId, this.messagesLimit);
      this.messages = pagedData.messages;
      this.lastVisibleMessageDoc = pagedData.lastVisibleDoc;
      this.hasMoreMessages = pagedData.hasMore;

      console.log('loadInitialMessagesAndSetupListener: Initial messages loaded. Count:', this.messages.length);
      console.log('loadInitialMessagesAndSetupListener: Last visible doc:', this.lastVisibleMessageDoc);
      console.log('loadInitialMessagesAndSetupListener: Has more messages:', this.hasMoreMessages);

      if (this.messages.length > 0) {
        this.firstVisibleMessageTimestamp = this.messages[this.messages.length - 1].timestamp;
        console.log('loadInitialMessagesAndSetupListener: First visible message timestamp (oldest loaded):', this.firstVisibleMessageTimestamp?.toDate());
      } else {
        this.firstVisibleMessageTimestamp = Timestamp.now();
        console.log('loadInitialMessagesAndSetupListener: No initial messages, setting firstVisibleMessageTimestamp to now.');
      }

      this.isLoading = false;
      this.cdr.detectChanges();

      this.setupNewMessagesListener();
      console.log('loadInitialMessagesAndSetupListener: New messages listener set up.');

      setTimeout(async () => {
        console.log('loadInitialMessagesAndSetupListener: Scrolling to bottom after initial load.');
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

  /**
   * Imposta un listener per i nuovi messaggi che arrivano dopo il caricamento iniziale.
   */
  private setupNewMessagesListener() {
    console.log('setupNewMessagesListener: Setting up listener for new messages.');
    this.newMessagesListener?.unsubscribe();
    if (!this.groupId || !this.firstVisibleMessageTimestamp) {
      console.warn('setupNewMessagesListener: Cannot set up listener, Group ID or firstVisibleMessageTimestamp missing.');
      return;
    }

    this.newMessagesListener = this.groupChatService.getNewGroupMessages(this.groupId, this.firstVisibleMessageTimestamp).subscribe(
      async (newIncomingMessages: GroupMessage[]) => {
        console.log('newMessagesListener: Received new incoming messages:', newIncomingMessages.length);
        if (newIncomingMessages.length > 0) {
          const wasAtBottomBeforeUpdate = await this.isUserNearBottomCheckNeeded();
          console.log('newMessagesListener: User was at bottom before update:', wasAtBottomBeforeUpdate);

          const existingMessageIds = new Set(this.messages.map(m => m.messageId));
          const uniqueNewMessages = newIncomingMessages.filter(msg => msg.messageId && !existingMessageIds.has(msg.messageId));
          console.log('newMessagesListener: Unique new messages:', uniqueNewMessages.length);

          if (uniqueNewMessages.length > 0) {
            this.messages = [...this.messages, ...uniqueNewMessages].sort((a, b) => {
              const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
              const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
              return timeA - timeB;
            });
            this.cdr.detectChanges();

            this.firstVisibleMessageTimestamp = this.messages[this.messages.length - 1].timestamp;
            console.log('newMessagesListener: Messages updated. New first visible timestamp:', this.firstVisibleMessageTimestamp?.toDate());

            if (wasAtBottomBeforeUpdate) {
              console.log('newMessagesListener: Scrolling to bottom due to new messages and user at bottom.');
              setTimeout(() => this.scrollToBottom(300), 50);
            } else {
              this.showScrollToBottom = true;
              console.log('newMessagesListener: Showing scroll to bottom button.');
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

  /**
   * Helper per controllare se l'utente è vicino al fondo.
   */
  private async isUserNearBottomCheckNeeded(): Promise<boolean> {
    if (!this.content) return true;
    const scrollElement = await this.content.getScrollElement();
    const scrollHeight = scrollElement.scrollHeight;
    const scrollTop = scrollElement.scrollTop;
    const clientHeight = scrollElement.clientHeight;
    const threshold = 100;
    return (scrollHeight - scrollTop - clientHeight) < threshold;
  }

  /**
   * Osserva gli eventi di scroll per mostrare/nascondere il pulsante "scorri in basso".
   */
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
      }

      this.lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop;
      this.cdr.detectChanges();
    });
  }

  /**
   * Carica più messaggi quando l'utente scorre in alto (infinite scroll).
   * @param event L'evento di infinite scroll.
   */
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

  /**
   * Invia un nuovo messaggio nel gruppo.
   */
  async sendMessage() {
    console.log('sendMessage: Attempting to send message.');
    if (!this.newMessageText.trim() || !this.groupId || !this.currentUserId) {
      console.warn('sendMessage: Cannot send message: empty text, group ID, or current user ID missing.');
      return;
    }

    try {
      console.log(`sendMessage: Sending message to group ${this.groupId} from user ${this.currentUserId}: "${this.newMessageText.trim()}".`);
      await this.groupChatService.sendMessage(this.groupId, this.currentUserId, this.newMessageText.trim());
      this.newMessageText = '';
      this.cdr.detectChanges();
      setTimeout(() => this.scrollToBottom(), 50);
      console.log('sendMessage: Message sent successfully.');
    } catch (error) {
      console.error('Errore durante l\'invio del messaggio di gruppo:', error);
      await this.presentFF7Alert('Impossibile inviare il messaggio di gruppo.');
    }
  }

  /**
   * Scrolla la chat fino in fondo.
   * @param duration Durata dello scroll in millisecondi.
   */
  async scrollToBottom(duration: number = 300) {
    if (this.content) {
      await this.content.scrollToBottom(duration);
    }
  }

  /**
   * Determina se un messaggio è stato inviato dall'utente attualmente loggato.
   * @param senderId L'ID del mittente del messaggio.
   * @returns Vero se il messaggio è stato inviato dall'utente loggato, falso altrimenti.
   */
  isMyMessage(senderId: string): boolean {
    return senderId === this.currentUserId;
  }

  /**
   * Decide se mostrare il divisore della data sopra un messaggio.
   */
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

  /**
   * Formatta il timestamp di un messaggio per la visualizzazione come intestazione della data.
   */
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

  /**
   * Presenta un alert personalizzato stile Final Fantasy VII.
   */
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

  /**
   * Presenta la modal con le informazioni del gruppo.
   */
  async presentGroupInfoModal() {
    console.log('presentGroupInfoModal: Attempting to present group info modal.');
    if (!this.groupDetails) {
      console.warn('presentGroupInfoModal: Group details not available. Cannot open modal.');
      await this.presentFF7Alert('Dettagli del gruppo non disponibili.');
      return;
    }
    if (this.groupInfoModal) {
      console.log('presentGroupInfoModal: Opening group info modal.');
      await this.groupInfoModal.present();
    } else {
      console.error('presentGroupInfoModal: groupInfoModal reference is null/undefined. This might be due to a timing issue if the modal is not yet rendered.');
    }
  }

  /**
   * Chiede conferma all'utente prima di abbandonare il gruppo.
   */
  async confirmLeaveGroup() {
    // Prima chiudi la modal di informazione, poi chiedi conferma
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
}
