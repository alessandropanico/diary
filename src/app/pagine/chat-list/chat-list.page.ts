import { Component, OnInit, OnDestroy } from '@angular/core';
import { ChatService } from 'src/app/services/chat.service'; 
import { UserDataService } from 'src/app/services/user-data.service'; // Assicurati che il percorso sia corretto
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Per ottenere l'utente autenticato
import { Subscription } from 'rxjs'; // Per gestire la sottoscrizione ai messaggi
import { Router } from '@angular/router'; // Per la navigazione

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.page.html',
  styleUrls: ['./chat-list.page.scss'],
  standalone: false,
})
export class ChatListPage implements OnInit, OnDestroy {

  conversations: any[] = []; // Array per memorizzare le conversazioni
  loggedInUserId: string | null = null; // ID dell'utente attualmente loggato
  isLoading: boolean = true; // Flag per mostrare/nascondere lo spinner di caricamento

  private authStateUnsubscribe: (() => void) | undefined; // Per unsubscriere l'osservatore di Firebase Auth
  private conversationsSubscription: Subscription | undefined; // Per unsubscriere l'observable delle conversazioni

  constructor(
    private chatService: ChatService,
    private userDataService: UserDataService, // Iniettiamo UserDataService
    private router: Router
  ) { }

  ngOnInit() {
    this.isLoading = true; // Inizialmente impostiamo a true per mostrare lo spinner
    const auth = getAuth();

    // Ascolta i cambiamenti dello stato di autenticazione
    this.authStateUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.loggedInUserId = user.uid;
        console.log('ChatListPage: Utente loggato ID:', this.loggedInUserId);
        this.loadUserConversations(); // Carica le conversazioni solo se l'utente è loggato
      } else {
        this.loggedInUserId = null;
        this.conversations = []; // Nessun utente, nessuna conversazione
        this.isLoading = false;
        console.log('ChatListPage: Nessun utente loggato, reindirizzo al login.');
        this.router.navigateByUrl('/login'); // Reindirizza al login se non autenticato
      }
    });
  }

  // Metodo per caricare le conversazioni dell'utente loggato
  async loadUserConversations() {
  if (!this.loggedInUserId) {
    console.warn('ChatListPage: Impossibile caricare le conversazioni, loggedInUserId è nullo.');
    this.isLoading = false;
    return;
  }

  this.conversationsSubscription = this.chatService.getUserConversations(this.loggedInUserId).subscribe(async (convs) => {
    console.log('ChatListPage: Conversazioni recuperate grezze:', convs);
    const processedConvs: any[] = [];

    for (const conv of convs) {
      const otherParticipantId = conv.participants.find((id: string) => id !== this.loggedInUserId);
      // Lasciamo i fallback qui, ma UserDataService dovrebbe già fornire valori sensati
      let otherParticipantName = 'Utente Sconosciuto';
      let otherParticipantPhoto = 'assets/immaginiGenerali/default-avatar.jpg';

      if (otherParticipantId) {
        try {
          // otherUserData ora avrà le proprietà 'username' e 'profilePhotoUrl'
          const otherUserData = await this.userDataService.getUserDataById(otherParticipantId);

          if (otherUserData) {
            // Questi campi saranno sempre stringhe grazie a UserDataService
            otherParticipantName = otherUserData.username; // Usa username
            otherParticipantPhoto = otherUserData.profilePhotoUrl; // Usa profilePhotoUrl
          }
        } catch (error) {
          console.error('Errore nel recupero dati altro partecipante:', otherParticipantId, error);
          // I fallback rimangono invariati
        }
      }

      processedConvs.push({
        ...conv,
        otherParticipantId,
        otherParticipantName,
        otherParticipantPhoto,
        displayLastMessageAt: conv.lastMessageAt?.toDate ? this.formatDate(conv.lastMessageAt.toDate()) : 'N/A'
      });
    }
    this.conversations = processedConvs;
    this.isLoading = false;
  }, (error) => {
    console.error('Errore nel recupero delle conversazioni:', error);
    this.isLoading = false;
  });
}

  // Metodo per aprire la chat specifica
  openChat(conversationId: string) {
    this.router.navigate(['/chat', conversationId]);
  }

  // Funzione di utilità per formattare la data per una visualizzazione amichevole
  formatDate(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1); // Setta a ieri

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Es: "14:35"
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ieri';
    } else if (today.getFullYear() === date.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }); // Es: "Lug 10"
    } else {
      return date.toLocaleDateString(); // Es: "10/07/2024"
    }
  }

  // Pulizia delle sottoscrizioni quando il componente viene distrutto
  ngOnDestroy(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    if (this.conversationsSubscription) {
      this.conversationsSubscription.unsubscribe();
    }
  }
}
