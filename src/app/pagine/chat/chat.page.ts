// src/app/pagine/chat/chat.page.ts
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService, ExtendedConversation, Message, UserProfile } from 'src/app/services/chat.service'; // <-- Importa tutto dal chat.service
import { getAuth } from 'firebase/auth';
import { Subscription, firstValueFrom } from 'rxjs'; // Importa firstValueFrom
import { IonContent, AlertController } from '@ionic/angular';
import { UserDataService } from 'src/app/services/user-data.service';
import { QueryDocumentSnapshot } from 'firebase/firestore'; // Importa QueryDocumentSnapshot
import * as dayjs from 'dayjs'; // Importa dayjs

// Importa i plugin dayjs necessari
import 'dayjs/locale/it'; // Importa la locale italiana
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import updateLocale from 'dayjs/plugin/updateLocale';

// Estendi dayjs con i plugin e imposta la locale
dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.extend(updateLocale);

// Imposta la locale a italiano
dayjs.locale('it');

// Opzionale: Aggiorna le impostazioni di 'relativeTime' per un output più pulito in italiano
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

// L'interfaccia OtherUserChatData è equivalente a UserProfile.
// La manteniamo per ora come nel tuo codice, ma è una ridondanza che potresti eliminare.
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
export class ChatPage implements OnInit, OnDestroy {

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private userDataService: UserDataService,
    private alertCtrl: AlertController
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    this.initialScrollDone = false; // Reset del flag

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
        await this.loadOtherUserDetails(); // Carica i dettagli dell'altro utente
        this.loadInitialMessages(); // Carica i primi N messaggi (i più recenti)
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
    // IMPORTANTE: Quando si esce dalla chat, si marca come letta.
    // Questo è il momento ideale per farlo, poiché l'utente ha "visto" i messaggi.
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

    // Sottoscrivi l'Observable per ottenere i dettagli della conversazione
    const conversationDetails = await firstValueFrom(this.chatService.getConversationDetails(this.conversationId));

    if (conversationDetails && conversationDetails.participants) {
      const otherParticipantId = conversationDetails.participants.find((id: string) => id !== this.loggedInUserId);

      if (otherParticipantId) {
        const userDataFromService = await this.userDataService.getUserDataById(otherParticipantId);

        if (userDataFromService) {
          this.otherUser = {
            uid: userDataFromService.uid || '', // Assicurati che uid non sia undefined
            username: userDataFromService.nickname || userDataFromService.name || 'Utente Sconosciuto',
            displayName: userDataFromService.name || userDataFromService.nickname || 'Utente',
            profilePhotoUrl: userDataFromService.photo || 'assets/immaginiGenerali/default-avatar.jpg',
            bio: userDataFromService.bio || '',
            nickname: userDataFromService.nickname,
            name: userDataFromService.name,
            photo: userDataFromService.photo
          };
          console.log('ChatPage: Dettagli altro utente caricati:', this.otherUser);
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


  /**
   * Carica i primi messaggi più recenti per la chat.
   */
  private loadInitialMessages() {
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe(); // Rimuovi la vecchia sottoscrizione se esiste
    }

    // Sottoscriviti ai messaggi recenti tramite il servizio
    this.messagesSubscription = this.chatService.getMessages(this.conversationId!, this.messagesLimit).subscribe(data => {
      // Dato che il servizio restituisce i messaggi più recenti ordinati in decrescente
      // (dal più recente al più vecchio), li invertiamo per visualizzarli cronologicamente.
      this.messages = data.messages.reverse();
      this.lastVisibleMessageDoc = data.lastVisibleDoc; // Il documento più vecchio di questo batch
      this.hasMoreMessages = data.hasMore; // Ci sono altri messaggi più vecchi da caricare?
      this.isLoading = false;

      // Scrolla in basso solo la prima volta (dopo il caricamento iniziale)
      if (!this.initialScrollDone) {
        setTimeout(() => {
          this.scrollToBottom();
          this.initialScrollDone = true;

          // Marca i messaggi come letti dopo il caricamento iniziale e lo scroll
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
    // Non caricare se non ci sono più messaggi o se un caricamento è già in corso,
    // o se non c'è un documento da cui iniziare (nel caso sia il primo caricamento).
    if (!this.hasMoreMessages || this.isLoadingMoreMessages || !this.lastVisibleMessageDoc) {
      event.target.complete(); // Completa immediatamente lo spinner
      return;
    }

    this.isLoadingMoreMessages = true;

    try {
      const oldScrollHeight = (await this.content.getScrollElement()).scrollHeight;

      // Chiamiamo il metodo del servizio per ottenere i messaggi precedenti
      const data = await this.chatService.getOlderMessages(this.conversationId!, this.messagesLimit, this.lastVisibleMessageDoc);

      // Invertiamo i messaggi perché li riceviamo dal più nuovo al più vecchio
      // e li aggiungiamo all'inizio dell'array esistente
      this.messages = [...data.messages.reverse(), ...this.messages];
      this.lastVisibleMessageDoc = data.lastVisibleDoc; // Aggiorna il punto di partenza per il prossimo caricamento
      this.hasMoreMessages = data.hasMore; // Aggiorna lo stato per l'infinite scroll

      this.isLoadingMoreMessages = false;
      event.target.complete(); // Completa lo spinner dell'infinite scroll

      // Mantiene la posizione dello scroll dopo aver aggiunto i messaggi in alto
      // Questo impedisce che lo scroll "salti" in cima.
      this.content.getScrollElement().then(newEl => {
        // La nuova altezza sarà maggiore, quindi scrolliamo verso il basso della differenza
        this.content.scrollToPoint(0, newEl.scrollHeight - oldScrollHeight, 0);
      });

    } catch (error) {
      console.error('Errore nel caricamento di più messaggi:', error);
      await this.presentFF7Alert('Errore nel caricamento di più messaggi.');
      this.isLoadingMoreMessages = false;
      event.target.complete();
    }
  }

  /**
   * Invia un nuovo messaggio nella conversazione.
   */
  async sendMessage() {
    if (!this.newMessageText.trim() || !this.conversationId || !this.loggedInUserId) {
      return;
    }

    try {
      await this.chatService.sendMessage(this.conversationId, this.loggedInUserId, this.newMessageText.trim());
      this.newMessageText = '';
      // Poiché la sottoscrizione ai messaggi è attiva, il nuovo messaggio apparirà automaticamente.
      // Aspettiamo un breve timeout per permettere al DOM di aggiornarsi e poi scrolliamo in basso.
      setTimeout(() => this.scrollToBottom(), 100);
    } catch (error) {
      console.error('Errore durante l\'invio del messaggio:', error);
      await this.presentFF7Alert('Impossibile inviare il messaggio.');
    }
  }

  /**
   * Scorre la chat fino all'ultimo messaggio.
   */
  scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300); // Scorrimento animato di 300ms
    }
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
      return false; // Gestisci il caso di messaggio o timestamp null
    }
    // Mostra sempre la data per il primo messaggio
    if (index === 0) {
      return true;
    }
    const currentMessageDate = dayjs(message.timestamp).startOf('day');
    const previousMessage = this.messages[index - 1];
    if (!previousMessage || !previousMessage.timestamp) {
      return true; // Se il messaggio precedente è problematico o non ha timestamp, mostra la data
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
      cssClass: 'ff7-alert', // Assicurati di avere questo CSS definito globalmente
      header: 'Attenzione',
      message,
      buttons: [
        {
          text: 'OK',
          cssClass: 'ff7-alert-button', // Assicurati di avere questo CSS definito
          role: 'cancel'
        }
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios' // O 'md' per Android
    });
    await alert.present();
  }
}
