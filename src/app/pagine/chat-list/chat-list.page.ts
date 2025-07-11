// chat-list.page.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ChatService } from 'src/app/services/chat.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.page.html',
  styleUrls: ['./chat-list.page.scss'],
  standalone: false,
})
export class ChatListPage implements OnInit, OnDestroy {

  conversations: any[] = [];
  loggedInUserId: string | null = null;
  isLoading: boolean = true;

  private authStateUnsubscribe: (() => void) | undefined;
  private conversationsSubscription: Subscription | undefined;

  constructor(
    private chatService: ChatService,
    private userDataService: UserDataService,
    private router: Router
  ) { }

  ngOnInit() {
    this.isLoading = true;
    const auth = getAuth();

    this.authStateUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.loggedInUserId = user.uid;
        console.log('ChatListPage: Utente loggato ID:', this.loggedInUserId);
        this.loadUserConversations();
      } else {
        this.loggedInUserId = null;
        this.conversations = [];
        this.isLoading = false;
        console.log('ChatListPage: Nessun utente loggato, reindirizzo al login.');
        this.router.navigateByUrl('/login');
      }
    });
  }

  async loadUserConversations() {
    if (!this.loggedInUserId) {
      console.warn('ChatListPage: Impossibile caricare le conversazioni, loggedInUserId è nullo.');
      this.isLoading = false;
      return;
    }

    this.conversationsSubscription = this.chatService.getUserConversations(this.loggedInUserId).subscribe(async (rawConvs: any[]) => { // rawConvs è di tipo any[]
      console.log('ChatListPage: Conversazioni recuperate grezze:', rawConvs);
      const processedConvs: any[] = [];

      for (const conv of rawConvs) { // conv è di tipo any (derivato da rawConvs: any[])
        // Assicurati che 'participants' sia un array prima di usarlo
        const otherParticipantId = Array.isArray(conv.participants) ?
                                   (conv.participants as string[]).find((id: string) => id !== this.loggedInUserId) :
                                   undefined;

        let otherParticipantName = 'Utente Sconosciuto';
        let otherParticipantPhoto = 'assets/immaginiGenerali/default-avatar.jpg';

        if (otherParticipantId) {
          try {
            const otherUserData = await this.userDataService.getUserDataById(otherParticipantId);

            if (otherUserData) {
              otherParticipantName = otherUserData.username;
              otherParticipantPhoto = otherUserData.profilePhotoUrl;
            }
          } catch (error) {
            console.error('Errore nel recupero dati altro partecipante:', otherParticipantId, error);
          }
        }

        // *** LOGICA PRINCIPALE: Controlla chi ha inviato l'ultimo messaggio ***
        // Assicurati che lastMessageSenderId esista nel documento di conversazione
        const lastMessageSenderId = (conv.lastMessageSenderId as string | undefined);
        const wasLastMessageSentByMe = this.loggedInUserId && lastMessageSenderId === this.loggedInUserId;
        const lastMessagePrefix = wasLastMessageSentByMe ? 'Io: ' : ''; // <-- Cambiato "Tu:" a "Io:"

        processedConvs.push({
          ...conv,
          otherParticipantId,
          otherParticipantName,
          otherParticipantPhoto,
          displayLastMessageAt: conv.lastMessageAt?.toDate ? this.formatDate(conv.lastMessageAt.toDate()) : 'N/A',
          wasLastMessageSentByMe,
          lastMessagePrefix
        });
      }
      this.conversations = processedConvs;
      this.isLoading = false;
    }, (error) => {
      console.error('Errore nel recupero delle conversazioni:', error);
      this.isLoading = false;
    });
  }

  openChat(conversationId: string) {
    this.router.navigate(['/chat', conversationId]);
  }

  formatDate(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ieri';
    } else if (today.getFullYear() === date.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString();
    }
  }

  ngOnDestroy(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    if (this.conversationsSubscription) {
      this.conversationsSubscription.unsubscribe();
    }
  }
}
