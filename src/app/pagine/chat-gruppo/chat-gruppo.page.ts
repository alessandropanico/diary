// src/app/pagine/chat-gruppo/chat-gruppo.page.ts

import { Component, OnInit, ViewChild, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, InfiniteScrollCustomEvent, NavController, AlertController } from '@ionic/angular';
import { getAuth } from 'firebase/auth';
import { Subscription, firstValueFrom } from 'rxjs';
// ⭐ Importa i nuovi metodi dal servizio ⭐
import { GroupChatService, GroupChat, GroupMessage, PagedGroupMessages } from '../../services/group-chat.service';
import { UserDataService, UserDashboardCounts } from '../../services/user-data.service';
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
})
export class ChatGruppoPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(IonContent) content!: IonContent;

  groupId: string | null = null;
  currentUserId: string | null = null;
  groupDetails: GroupChat | null = null;
  messages: GroupMessage[] = [];
  newMessageText: string = '';
  isLoading: boolean = true;
  isLoadingMoreMessages: boolean = false;
  private lastVisibleMessageDoc: QueryDocumentSnapshot | null = null; // Il documento più vecchio caricato
  private firstVisibleMessageTimestamp: Timestamp | null = null; // Il timestamp del messaggio più recente caricato inizialmente
  private messagesLimit: number = 20;
  public hasMoreMessages: boolean = true; // Indica se ci sono più messaggi vecchi da caricare
  private initialScrollDone: boolean = false;
  showScrollToBottom: boolean = false;
  private lastScrollTop = 0;

  private auth = getAuth();
  private messagesSubscription: Subscription | undefined; // Per i messaggi iniziali/nuovi in tempo reale
  private groupDetailsSubscription: Subscription | undefined;
  private newMessagesListener: Subscription | undefined; // ⭐ NUOVO: Listener per i nuovi messaggi ⭐

  constructor(
    private route: ActivatedRoute,
    private groupChatService: GroupChatService,
    private userDataService: UserDataService,
    private navCtrl: NavController,
    private router: Router,
    private alertController: AlertController,
    private cdr: ChangeDetectorRef // ⭐ Inject ChangeDetectorRef ⭐
  ) {}

  async ngOnInit() {
    this.isLoading = true;
    this.initialScrollDone = false;
    this.messages = []; // Resetta i messaggi all'inizializzazione della pagina
    this.lastVisibleMessageDoc = null;
    this.firstVisibleMessageTimestamp = null;
    this.hasMoreMessages = true;

    this.currentUserId = this.auth.currentUser?.uid || null;

    if (!this.currentUserId) {
      await this.presentFF7Alert('Devi essere loggato per visualizzare le chat di gruppo.');
      this.router.navigateByUrl('/login');
      this.isLoading = false;
      return;
    }

    this.route.paramMap.subscribe(async params => {
      const newGroupId = params.get('id');
      if (this.groupId !== newGroupId) { // Solo ricarica se l'ID del gruppo è cambiato
        this.groupId = newGroupId;
        this.resetChatState(); // ⭐ Resetta lo stato quando l'ID del gruppo cambia ⭐

        if (this.groupId) {
          this.groupDetailsSubscription?.unsubscribe();
          this.groupDetailsSubscription = this.groupChatService.getGroupDetails(this.groupId).subscribe(
            async (group) => {
              this.groupDetails = group;
              if (!group) {
                console.error('Group not found or inaccessible.');
                await this.presentFF7Alert('Gruppo non trovato o non accessibile.');
                this.router.navigateByUrl('/chat-list');
                return;
              }
              if (this.currentUserId && !this.groupDetails!.members.includes(this.currentUserId)) {
                console.warn('Current user is not a member of this group.');
                await this.presentFF7Alert('Non sei un membro di questo gruppo.');
                this.router.navigateByUrl('/chat-list');
                return;
              }
              await this.loadInitialMessagesAndSetupListener(); // ⭐ Carica messaggi e imposta listener ⭐
            },
            async (error) => {
              console.error('Error loading group details:', error);
              await this.presentFF7Alert('Errore nel caricamento dei dettagli del gruppo.');
              this.router.navigateByUrl('/chat-list');
            }
          );
        } else {
          console.error('Group ID not provided in route.');
          await this.presentFF7Alert('ID del gruppo mancante.');
          this.router.navigateByUrl('/chat-list');
          this.isLoading = false;
        }
      }
    });
  }

  ngAfterViewInit() {
    this.observeScroll();
  }

  ngOnDestroy() {
    this.messagesSubscription?.unsubscribe();
    this.groupDetailsSubscription?.unsubscribe();
    this.newMessagesListener?.unsubscribe(); // ⭐ Unsubscribe dal nuovo listener ⭐
    if (this.currentUserId && this.groupId) {
      this.groupChatService.markGroupMessagesAsRead(this.groupId, this.currentUserId)
        .catch(error => console.error('Errore nel marcare i messaggi di gruppo come letti:', error));
    }
  }

  /**
   * Resetta lo stato della chat quando si cambia gruppo o si ricarica.
   */
  private resetChatState() {
    this.messagesSubscription?.unsubscribe();
    this.newMessagesListener?.unsubscribe();
    this.messages = [];
    this.lastVisibleMessageDoc = null;
    this.firstVisibleMessageTimestamp = null;
    this.hasMoreMessages = true;
    this.isLoading = true;
    this.isLoadingMoreMessages = false;
    this.initialScrollDone = false;
    this.showScrollToBottom = false;
    this.lastScrollTop = 0;
    this.cdr.detectChanges(); // Forza un aggiornamento della vista
  }

  /**
   * Carica i messaggi iniziali e imposta un listener per i nuovi messaggi.
   */
  private async loadInitialMessagesAndSetupListener() {
    if (!this.groupId) return;

    this.isLoading = true;
    try {
      const pagedData = await this.groupChatService.getInitialGroupMessages(this.groupId, this.messagesLimit);
      this.messages = pagedData.messages;
      this.lastVisibleMessageDoc = pagedData.lastVisibleDoc;
      this.hasMoreMessages = pagedData.hasMore;

      // Imposta il timestamp del messaggio più recente caricato
      if (this.messages.length > 0) {
        this.firstVisibleMessageTimestamp = this.messages[this.messages.length - 1].timestamp;
      } else {
        // Se non ci sono messaggi, usa il timestamp corrente come punto di partenza per i nuovi messaggi
        this.firstVisibleMessageTimestamp = Timestamp.now();
      }

      this.isLoading = false;
      this.cdr.detectChanges(); // Forza un aggiornamento della vista dopo il caricamento iniziale

      // ⭐ Imposta il listener per i NUOVI messaggi ⭐
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

  /**
   * Imposta un listener per i nuovi messaggi che arrivano dopo il caricamento iniziale.
   */
  private setupNewMessagesListener() {
    this.newMessagesListener?.unsubscribe(); // Assicurati di disiscriverti da listener precedenti
    if (!this.groupId || !this.firstVisibleMessageTimestamp) {
      return;
    }

    this.newMessagesListener = this.groupChatService.getNewGroupMessages(this.groupId, this.firstVisibleMessageTimestamp).subscribe(
      async (newIncomingMessages: GroupMessage[]) => {
        if (newIncomingMessages.length > 0) {
          const wasAtBottomBeforeUpdate = await this.isUserNearBottomCheckNeeded();

          // Filtra i messaggi già presenti (potrebbero esserci duplicati se il listener si sovrappone per un istante)
          const existingMessageIds = new Set(this.messages.map(m => m.messageId));
          const uniqueNewMessages = newIncomingMessages.filter(msg => msg.messageId && !existingMessageIds.has(msg.messageId));

          if (uniqueNewMessages.length > 0) {
            this.messages = [...this.messages, ...uniqueNewMessages].sort((a, b) => {
              const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
              const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
              return timeA - timeB;
            });
            this.cdr.detectChanges(); // Forza aggiornamento per i nuovi messaggi

            // Aggiorna il timestamp del messaggio più recente
            this.firstVisibleMessageTimestamp = this.messages[this.messages.length - 1].timestamp;

            if (wasAtBottomBeforeUpdate) {
              setTimeout(() => this.scrollToBottom(300), 50);
            } else {
              this.showScrollToBottom = true;
            }
          }
        }
      },
      (error) => {
        console.error('Errore nel listener dei nuovi messaggi:', error);
        // Gestisci l'errore, es. mostra un messaggio all'utente
      }
    );
  }

  /**
   * Helper per controllare se l'utente è vicino al fondo.
   * Usato per decidere se auto-scrollare.
   */
  private async isUserNearBottomCheckNeeded(): Promise<boolean> {
    if (!this.content) return true;
    const scrollElement = await this.content.getScrollElement();
    const scrollHeight = scrollElement.scrollHeight;
    const scrollTop = scrollElement.scrollTop;
    const clientHeight = scrollElement.clientHeight;
    const threshold = 100; // Un buffer di 100px
    return (scrollHeight - scrollTop - clientHeight) < threshold;
  }

  /**
   * Osserva gli eventi di scroll per mostrare/nascondere il pulsante "scorri in basso".
   */
  observeScroll() {
    this.content.ionScroll.subscribe(async (event) => {
      const scrollElement = await this.content.getScrollElement();
      const currentScrollTop = scrollElement.scrollTop;
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
      this.cdr.detectChanges(); // Per aggiornare lo stato di showScrollToBottom
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

      // Aggiungi solo messaggi unici
      const existingMessageIds = new Set(this.messages.map(m => m.messageId));
      const uniqueNewMessages = newMessages.filter(msg => msg.messageId && !existingMessageIds.has(msg.messageId));

      if (uniqueNewMessages.length > 0) {
        this.messages = [...uniqueNewMessages, ...this.messages]; // Aggiungi in cima
        this.lastVisibleMessageDoc = newLastVisibleDoc;
        this.hasMoreMessages = newHasMore;
        this.cdr.detectChanges(); // Forza aggiornamento della vista

        // Mantiene la posizione di scroll
        this.content.getScrollElement().then(newEl => {
          this.content.scrollToPoint(0, newEl.scrollHeight - oldScrollHeight, 0);
        });
      } else {
        this.hasMoreMessages = false; // Nessun nuovo messaggio unico trovato, non ci sono più messaggi
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
    if (!this.newMessageText.trim() || !this.groupId || !this.currentUserId) {
      console.warn('Impossibile inviare: testo vuoto, ID gruppo o utente corrente mancante.');
      return;
    }

    try {
      await this.groupChatService.sendMessage(this.groupId, this.currentUserId, this.newMessageText.trim());
      this.newMessageText = '';
      this.cdr.detectChanges(); // Aggiorna la vista per pulire l'input
      setTimeout(() => this.scrollToBottom(), 50); // Scorre in fondo dopo l'invio
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
   * @param message Il messaggio corrente.
   * @param index L'indice del messaggio nell'array.
   * @returns Vero se la data deve essere mostrata, falso altrimenti.
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
   * @param timestamp Il timestamp del messaggio (Firebase Timestamp).
   * @returns La stringa formattata della data.
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
   * @param message Il messaggio da visualizzare nell'alert.
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
   * Naviga alla pagina dei dettagli del gruppo.
   */
  goToGroupDetailsPage() {
    if (this.groupId) {
      this.router.navigate(['/group-details', this.groupId]);
    } else {
      console.warn('Impossibile navigare ai dettagli del gruppo: ID gruppo non disponibile.');
      this.presentFF7Alert('Impossibile visualizzare i dettagli di questo gruppo.');
    }
  }
}
