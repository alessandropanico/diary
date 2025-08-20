import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService, ExtendedConversation, Message, UserProfile } from 'src/app/services/chat.service';
import { getAuth } from 'firebase/auth';
import { Subscription, firstValueFrom } from 'rxjs';
import { IonContent, AlertController } from '@ionic/angular';
import { UserDataService } from 'src/app/services/user-data.service';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import * as dayjs from 'dayjs';

import 'dayjs/locale/it';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import updateLocale from 'dayjs/plugin/updateLocale';

import { Post } from 'src/app/interfaces/post'; // ⭐ AGGIUNGI QUESTO IMPORT ⭐


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

interface OtherUserChatData {
  uid: string;
  username: string;
  displayName: string;
  profilePhotoUrl: string;
  bio?: string;
  nickname?: string;
  name?: string;
  photo?: string;
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: false,
})
export class ChatPage implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild(IonContent) content!: IonContent;
  conversationId: string | null = null;
  messages: Message[] = [];
  newMessageText: string = '';
  loggedInUserId: string | null = null;
  otherUser: OtherUserChatData | null = null;
  messagesSubscription: Subscription | undefined;
  isLoading: boolean = true;
  isLoadingMoreMessages: boolean = false;
  private lastVisibleMessageDoc: QueryDocumentSnapshot | null = null;
  private messagesLimit: number = 20;
  public hasMoreMessages: boolean = true;
  private initialScrollDone: boolean = false;
  showScrollToBottom: boolean = false;
  private lastScrollTop = 0;

  isOtherUserBlocked: boolean = false;
  isBlockedByOtherUser: boolean = false;

  isSelectionMode: boolean = false;
  selectedMessages = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private userDataService: UserDataService,
    private alertCtrl: AlertController
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    this.initialScrollDone = false;

    const auth = getAuth();
    this.loggedInUserId = auth.currentUser ? auth.currentUser.uid : null;

    if (!this.loggedInUserId) {
      await this.presentFF7Alert('Devi essere loggato per visualizzare le chat.');
      this.router.navigateByUrl('/login');
      this.isLoading = false;
      return;
    }

    this.route.paramMap.subscribe(async params => {
      this.conversationId = params.get('conversationId');

      if (this.conversationId) {
        await this.loadOtherUserDetails();
        // ⭐ Queste sono le righe che devi aggiungere qui ⭐
        if (this.otherUser) {
          this.isOtherUserBlocked = await this.userDataService.isUserBlocked(this.otherUser.uid);
          this.isBlockedByOtherUser = await this.userDataService.isBlockedByTargetUser(this.otherUser.uid);
        }
        // ⭐ Fine delle righe da aggiungere ⭐
        this.loadInitialMessages();
      } else {
        await this.presentFF7Alert('ID conversazione mancante.');
        this.router.navigateByUrl('/home');
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy() {
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }

    if (this.loggedInUserId && this.conversationId) {
      this.chatService.markMessagesAsRead(this.conversationId, this.loggedInUserId)
        .catch(error => console.error('Errore nel marcare i messaggi come letti in ngOnDestroy:', error));
    }
  }

  /**
   * Carica i dettagli dell'altro utente della chat.
   */
  private async loadOtherUserDetails() {
    if (!this.conversationId || !this.loggedInUserId) return;

    const conversationDetails = await firstValueFrom(this.chatService.getConversationDetails(this.conversationId));

    if (conversationDetails && conversationDetails.participants) {
      const otherParticipantId = conversationDetails.participants.find((id: string) => id !== this.loggedInUserId);

      if (otherParticipantId) {
        const userDataFromService = await this.userDataService.getUserDataById(otherParticipantId);

        if (userDataFromService) {
          this.otherUser = {
            uid: userDataFromService.uid || '',
            username: userDataFromService.nickname || userDataFromService.name || 'Utente Sconosciuto',
            displayName: userDataFromService.name || userDataFromService.nickname || 'Utente',
            profilePhotoUrl: userDataFromService.photo || 'assets/immaginiGenerali/default-avatar.jpg',
            bio: userDataFromService.bio || '',
            nickname: userDataFromService.nickname,
            name: userDataFromService.name,
            photo: userDataFromService.photo
          };
        } else {
          console.warn('ChatPage: Dati utente non trovati per ID:', otherParticipantId);
          this.otherUser = {
            uid: otherParticipantId,
            username: 'Utente Sconosciuto',
            displayName: 'Utente Sconosciuto',
            profilePhotoUrl: 'assets/immaginiGenerali/default-avatar.jpg'
          };
        }
      } else {
        console.warn('ChatPage: Other participant ID not found in conversation details.');
        this.otherUser = null;
      }
    } else {
      console.warn('ChatPage: Conversation details or participants not found.');
      this.otherUser = null;
    }
  }

  observeScroll() {
    this.content.ionScroll.subscribe(async () => {
      const scrollElement = await this.content.getScrollElement();
      const currentScrollTop = scrollElement.scrollTop;
      const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;

      const threshold = 100;
      const isAtBottom = maxScrollTop - currentScrollTop < threshold;
      const isScrollingUp = currentScrollTop < this.lastScrollTop;

      if (isScrollingUp && !isAtBottom) {
        this.showScrollToBottom = true;
      } else if (isAtBottom) {
        this.showScrollToBottom = false;
      }

      this.lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop;
    });
  }

  ngAfterViewInit() {
    this.observeScroll();
  }


  /**
   * Carica i primi messaggi più recenti per la chat.
   */
  private loadInitialMessages() {
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
    this.messagesSubscription = this.chatService.getMessages(this.conversationId!, this.messagesLimit).subscribe(data => {
      this.messages = data.messages.reverse();
      this.lastVisibleMessageDoc = data.lastVisibleDoc;
      this.hasMoreMessages = data.hasMore;
      this.isLoading = false;

      if (!this.initialScrollDone) {
        setTimeout(() => {
          this.scrollToBottom();
          this.initialScrollDone = true;

          if (this.loggedInUserId && this.conversationId) {
            this.chatService.markMessagesAsRead(this.conversationId, this.loggedInUserId)
              .catch(error => console.error('Errore nel marcare i messaggi come letti dopo caricamento iniziale:', error));
          }

        }, 100);
      }
    }, async error => { // Aggiunto 'async' qui per usare await con presentFF7Alert
      console.error('Errore nel recupero dei messaggi iniziali:', error);
      await this.presentFF7Alert('Errore nel caricamento dei messaggi.');
      this.isLoading = false;
    });
  }

  /**
   * Carica più messaggi quando l'utente scorre in alto (infinite scroll).
   * @param event L'evento di infinite scroll.
   */
  async loadMoreMessages(event: any) {
    if (!this.hasMoreMessages || this.isLoadingMoreMessages || !this.lastVisibleMessageDoc) {
      event.target.complete();
      return;
    }

    this.isLoadingMoreMessages = true;

    try {
      const oldScrollHeight = (await this.content.getScrollElement()).scrollHeight;
      const data = await this.chatService.getOlderMessages(this.conversationId!, this.messagesLimit, this.lastVisibleMessageDoc);
      this.messages = [...data.messages.reverse(), ...this.messages];
      this.lastVisibleMessageDoc = data.lastVisibleDoc;
      this.hasMoreMessages = data.hasMore;

      this.isLoadingMoreMessages = false;
      event.target.complete();


      this.content.getScrollElement().then(newEl => {
        this.content.scrollToPoint(0, newEl.scrollHeight - oldScrollHeight, 0);
      });

    } catch (error) {
      console.error('Errore nel caricamento di più messaggi:', error);
      await this.presentFF7Alert('Errore nel caricamento di più messaggi.');
      this.isLoadingMoreMessages = false;
      event.target.complete();
    }
  }


  async sendMessage() {
    if (!this.newMessageText.trim() || !this.loggedInUserId || !this.otherUser?.uid) {
      console.warn('SENDMESSAGE - Impossibile inviare: testo vuoto, utente loggato o destinatario mancante.');
      return;
    }

    // ⭐⭐ MODIFICA QUI: USA LE VARIABILI DI STATO DEL COMPONENTE ⭐⭐
    this.isOtherUserBlocked = await this.userDataService.isUserBlocked(this.otherUser.uid);
    this.isBlockedByOtherUser = await this.userDataService.isBlockedByTargetUser(this.otherUser.uid);

    if (this.isOtherUserBlocked) {
      this.presentUnblockAlert();
      return;
    }
    if (this.isBlockedByOtherUser) {
      this.presentFF7Alert('Non puoi inviare messaggi. Sei stato bloccato da questo utente.');
      return;
    }
    // ⭐⭐ FINE MODIFICA ⭐⭐

    try {
      if (!this.conversationId) {
        this.conversationId = await this.chatService.getOrCreateConversation(this.loggedInUserId!, this.otherUser!.uid!);
        this.loadInitialMessages();
      }

      await this.chatService.sendMessage(this.conversationId, this.loggedInUserId, this.newMessageText.trim());
      this.newMessageText = '';
      setTimeout(() => this.scrollToBottom(), 100);

    } catch (error: any) {
      console.error('Errore durante l\'invio del messaggio o la creazione della chat:', error);
      if (error?.code === 'permission-denied' || error?.code === 'missing-or-insufficient-permissions') {
        this.presentFF7Alert('Impossibile inviare il messaggio: Permessi insufficienti. L\'utente potrebbe averti bloccato.');
      } else {
        this.presentFF7Alert('Impossibile inviare il messaggio.');
      }
    }
  }

  scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300);
    }
  }

  // Aggiungi questo metodo nel tuo componente ChatPage
  async presentUnblockAlert() {
    const alert = await this.alertCtrl.create({
      cssClass: 'ff7-alert',
      header: 'Utente bloccato',
      message: 'Hai bloccato questo utente. Vuoi sbloccarlo per inviare un messaggio?',
      buttons: [
        {
          text: 'Sblocca',
          handler: async () => {
            try {
              console.log('Chiamata a unblockUser() iniziata.'); // Aggiungi qui
              await this.userDataService.unblockUser(this.otherUser!.uid);

              // ⭐ Aggiungi questi console.log() per verificare l'aggiornamento dello stato
              this.isOtherUserBlocked = false;
              console.log('Stato del blocco aggiornato nel componente: isOtherUserBlocked è ora', this.isOtherUserBlocked);

              await this.presentFF7Alert('Utente sbloccato. Ora puoi inviare il tuo messaggio!');

            } catch (error) {
              console.error('Errore durante lo sblocco:', error);
              this.presentFF7Alert('Si è verificato un errore durante lo sblocco.');
            }
          }
        }
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }

  /**
   * Determina se un messaggio è stato inviato dall'utente attualmente loggato.
   * @param senderId L'ID del mittente del messaggio.
   * @returns Vero se il messaggio è stato inviato dall'utente loggato, falso altrimenti.
   */
  isMyMessage(senderId: string): boolean {
    return senderId === this.loggedInUserId;
  }

  /**
   * Decide se mostrare il divisore della data sopra un messaggio.
   * Il divisore viene mostrato per il primo messaggio o quando il giorno cambia.
   * @param message Il messaggio corrente.
   * @param index L'indice del messaggio nell'array.
   * @returns Vero se la data deve essere mostrata, falso altrimenti.
   */
  shouldShowDate(message: Message, index: number): boolean {
    if (!message || !message.timestamp) {
      return false;
    }
    if (index === 0) {
      return true;
    }
    const currentMessageDate = dayjs(message.timestamp).startOf('day');
    const previousMessage = this.messages[index - 1];
    if (!previousMessage || !previousMessage.timestamp) {
      return true;
    }
    const previousMessageDate = dayjs(previousMessage.timestamp).startOf('day');
    return !currentMessageDate.isSame(previousMessageDate, 'day');
  }

  /**
   * Formatta il timestamp di un messaggio per la visualizzazione come intestazione della data.
   * Mostra "Oggi", "Ieri" o la data completa.
   * @param timestamp Il timestamp del messaggio.
   * @returns La stringa formattata della data.
   */
  formatDateHeader(timestamp: Date): string {
    const d = dayjs(timestamp);
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
    const alert = await this.alertCtrl.create({
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

  goToOtherUserProfile() {
    if (this.otherUser && this.otherUser.uid) {
      this.router.navigate(['/profilo-altri-utenti', this.otherUser.uid]);
    } else {
      console.warn('Impossibile navigare al profilo: UID dell\'altro utente non disponibile.');
      this.presentFF7Alert('Impossibile visualizzare il profilo di questo utente.');
    }
  }

  /**
   * Naviga alla pagina del post completo.
   * @param postId L'ID del post.
   */
  goToPost(postId: string) {
    // ⭐⭐ CORREZIONE QUI ⭐⭐
    // Utilizziamo il percorso della rotta corretto per la pagina del post singolo.
    this.router.navigateByUrl(`/notizia-singola/${postId}`);
  }

  // Aggiungi questi nuovi metodi alla classe ChatPage
  toggleSelectionMode() {
    this.isSelectionMode = !this.isSelectionMode;
    this.selectedMessages.clear();
  }

  selectMessage(message: Message) {
    if (this.isSelectionMode) {
      if (this.selectedMessages.has(message.id)) {
        this.selectedMessages.delete(message.id);
      } else {
        this.selectedMessages.add(message.id);
      }
      // Esci dalla modalità di selezione se non ci sono messaggi selezionati
      if (this.selectedMessages.size === 0) {
        this.isSelectionMode = false;
      }
    }
  }

  async deleteSelectedMessages() {
    if (this.selectedMessages.size === 0) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Elimina Messaggi',
      message: `Sei sicuro di voler eliminare i ${this.selectedMessages.size} messaggi selezionati?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina',
          handler: async () => {
            try {
              const messageIdsToDelete = Array.from(this.selectedMessages);
              await this.chatService.deleteMessages(this.conversationId!, messageIdsToDelete);

              // Pulisci lo stato dopo l'eliminazione
              this.selectedMessages.clear();
              this.isSelectionMode = false;

              await this.presentFF7Alert('Messaggio/i eliminato/i con successo!');
            } catch (error) {
              console.error('Errore durante l\'eliminazione dei messaggi:', error);
              await this.presentFF7Alert('Impossibile eliminare i messaggi. Riprova.');
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
