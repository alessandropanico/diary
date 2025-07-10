import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService } from 'src/app/services/chat.service';
import { getAuth } from 'firebase/auth';
import { Observable, Subscription } from 'rxjs';
import { IonContent, AlertController } from '@ionic/angular';
import { UserDataService } from 'src/app/services/user-data.service';


interface OtherUserChatData {
  uid: string;
  username: string;
  displayName: string;
  profilePhotoUrl: string;
  bio?: string;
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
  messages: any[] = [];
  newMessageText: string = '';
  loggedInUserId: string | null = null;
  otherUser: OtherUserChatData | null = null;
  messagesSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private userDataService: UserDataService,
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
        this.messagesSubscription = this.chatService.getMessages(this.conversationId).subscribe(async messages => {
          this.messages = messages;
          const conversationDetails = await this.chatService.getConversationDetails(this.conversationId!);
          if (conversationDetails && conversationDetails.participants) {
            const otherParticipantId = conversationDetails.participants.find((id: string) => id !== this.loggedInUserId);
            if (otherParticipantId) {
              this.otherUser = await this.userDataService.getUserDataById(otherParticipantId);
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
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
  }

  async sendMessage() {
    if (!this.newMessageText.trim() || !this.conversationId || !this.loggedInUserId) {
      return;
    }

    try {
      await this.chatService.sendMessage(this.conversationId, this.loggedInUserId, this.newMessageText.trim());
      this.newMessageText = '';
      this.scrollToBottom();
    } catch (error) {
      console.error('Errore durante l\'invio del messaggio:', error);
      this.presentFF7Alert('Impossibile inviare il messaggio.');
    }
  }

  scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300);
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
