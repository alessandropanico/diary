// src/app/pagine/chat/chat.page.ts

import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService } from 'src/app/services/chat.service'; // Importa il ChatService
import { getAuth } from 'firebase/auth'; // Per ottenere l'ID dell'utente corrente
import { Observable, Subscription } from 'rxjs'; // Per gestire gli Observable e le sottoscrizioni
import { IonContent, AlertController } from '@ionic/angular'; // Per lo scroll automatico e gli alert
import { UserDataService } from 'src/app/services/user-data.service'; // Per ottenere i dati dell'altro utente

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: false,
})
export class ChatPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent; // Riferimento al contenuto per lo scroll

  conversationId: string | null = null;
  messages: any[] = [];
  newMessageText: string = ''; // Contiene il testo del messaggio da inviare
  loggedInUserId: string | null = null;
  otherUser: any = null; // Dati dell'altro utente nella chat

  messagesSubscription: Subscription | undefined; // Per gestire la sottoscrizione ai messaggi

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private userDataService: UserDataService, // Inietta UserDataService
    private alertCtrl: AlertController
  ) { }

  async ngOnInit() {
    const auth = getAuth();
    this.loggedInUserId = auth.currentUser ? auth.currentUser.uid : null;

    if (!this.loggedInUserId) {
      this.presentFF7Alert('Devi essere loggato per visualizzare le chat.');
      this.router.navigateByUrl('/login');
      return;
    }

    this.route.paramMap.subscribe(async params => {
      this.conversationId = params.get('conversationId');

      if (this.conversationId) {
        // Iscriviti ai messaggi in tempo reale
        this.messagesSubscription = this.chatService.getMessages(this.conversationId).subscribe(async messages => {
          this.messages = messages;
          // Ottieni i dettagli della conversazione per identificare l'altro utente
          const conversationDetails = await this.chatService.getConversationDetails(this.conversationId!);
          if (conversationDetails && conversationDetails.participants) {
            const otherParticipantId = conversationDetails.participants.find((id: string) => id !== this.loggedInUserId);
            if (otherParticipantId) {
              this.otherUser = await this.userDataService.getUserDataById(otherParticipantId);
              // Forza lo scroll alla fine dopo il caricamento iniziale dei messaggi
              setTimeout(() => this.scrollToBottom(), 100);
            }
          }
        }, error => {
          console.error('Errore nel recupero dei messaggi:', error);
          this.presentFF7Alert('Errore nel caricamento dei messaggi.');
        });
      } else {
        this.presentFF7Alert('ID conversazione mancante.');
        this.router.navigateByUrl('/home');
      }
    });
  }

  ngOnDestroy() {
    // Annulla la sottoscrizione quando la pagina viene distrutta per evitare memory leaks
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
  }

  async sendMessage() {
    if (!this.newMessageText.trim() || !this.conversationId || !this.loggedInUserId) {
      return; // Non inviare messaggi vuoti
    }

    try {
      await this.chatService.sendMessage(this.conversationId, this.loggedInUserId, this.newMessageText.trim());
      this.newMessageText = ''; // Pulisci l'input
      this.scrollToBottom(); // Scorri alla fine dopo aver inviato il messaggio
    } catch (error) {
      console.error('Errore durante l\'invio del messaggio:', error);
      this.presentFF7Alert('Impossibile inviare il messaggio.');
    }
  }

  scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300); // 300ms di animazione
    }
  }

  isMyMessage(senderId: string): boolean {
    return senderId === this.loggedInUserId;
  }

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
}
