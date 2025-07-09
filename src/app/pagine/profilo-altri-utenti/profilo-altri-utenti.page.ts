import { Component, OnInit, OnDestroy } from '@angular/core'; // Importa OnDestroy
import { ActivatedRoute, Router } from '@angular/router';
import { UserDataService } from 'src/app/services/user-data.service';
import { getAuth, User, onAuthStateChanged } from 'firebase/auth'; // Importa User e onAuthStateChanged
import { ChatService } from 'src/app/services/chat.service';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs'; // Importa Subscription

@Component({
  selector: 'app-profilo-altri-utenti',
  templateUrl: './profilo-altri-utenti.page.html',
  styleUrls: ['./profilo-altri-utenti.page.scss'],
  standalone: false,
})
export class ProfiloAltriUtentiPage implements OnInit, OnDestroy { // Implementa OnDestroy

  profileData: any = null;
  isLoading: boolean = true;
  loggedInUserId: string | null = null;
  private authStateSubscription: Subscription | undefined; // Per gestire la sottoscrizione

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private chatService: ChatService,
    private alertCtrl: AlertController
  ) { }

  async ngOnInit() {
    this.isLoading = true;

    // Sottoscriviti ai cambiamenti dello stato di autenticazione
    const auth = getAuth();
    this.authStateSubscription = new Subscription(); // Inizializza la sottoscrizione

    this.authStateSubscription.add(onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.loggedInUserId = user.uid;
        console.log('NGONINIT (onAuthStateChanged) - Utente loggato ID:', this.loggedInUserId);
      } else {
        this.loggedInUserId = null;
        console.log('NGONINIT (onAuthStateChanged) - Nessun utente loggato.');
        // Potresti voler reindirizzare al login qui se necessario per il contesto.
      }
      // Dopo aver ottenuto lo stato di autenticazione, puoi procedere a caricare i dati del profilo
      // Sposta la logica di caricamento del profilo qui dentro l'observer per assicurarti che l'UID sia disponibile.
      await this.loadUserProfile();
    }));

    // La logica di caricamento del profilo è stata spostata in un metodo separato
    // per essere chiamata dopo aver verificato lo stato di autenticazione.
    // Non caricarla qui direttamente.
  }

  // Metodo per caricare i dati del profilo, chiamato dopo la verifica auth
  private async loadUserProfile() {
    this.route.paramMap.subscribe(async params => {
      const userId = params.get('id');
      console.log('NGONINIT - ID utente profilo da URL:', userId);

      if (userId) {
        try {
          this.profileData = await this.userDataService.getUserDataById(userId);
          if (!this.profileData) {
            console.warn('Nessun dato trovato per l\'utente con ID:', userId);
            await this.presentFF7Alert('Profilo utente non trovato.');
          } else {
            console.log('NGONINIT - Dati profilo caricati:', this.profileData);
          }
        } catch (error) {
          console.error('NGONINIT - Errore nel caricamento del profilo utente:', error);
          await this.presentFF7Alert('Si è verificato un errore durante il caricamento del profilo.');
        } finally {
          this.isLoading = false;
        }
      } else {
        console.warn('NGONINIT - Nessun ID utente fornito nell\'URL per il profilo esterno.');
        this.isLoading = false;
        await this.presentFF7Alert('ID utente mancante.');
        this.router.navigateByUrl('/home');
      }
    });
  }

  async startChat() {
    console.log('STARTCHAT - Avvio funzione chat.');

    if (!this.loggedInUserId) {
      console.error('STARTCHAT - Errore: Utente non loggato al momento della richiesta di chat.');
      await this.presentFF7Alert('Devi essere loggato per avviare una chat.');
      // Reindirizza al login solo se la pagina corrente lo permette e ha senso.
      // this.router.navigateByUrl('/login');
      return;
    }

    if (!this.profileData || !this.profileData.uid) {
      console.error('STARTCHAT - ID del destinatario non disponibile:', this.profileData);
      await this.presentFF7Alert('Impossibile avviare la chat: ID del destinatario non disponibile.');
      return;
    }

    if (this.loggedInUserId === this.profileData.uid) {
        console.warn('STARTCHAT - Non puoi messaggiare te stesso.');
        await this.presentFF7Alert('Non puoi messaggiare te stesso.');
        return;
    }

    console.log('STARTCHAT - Tentativo di avviare chat tra:', this.loggedInUserId, 'e', this.profileData.uid);

    try {
        const conversationId = await this.chatService.getOrCreateConversation(this.loggedInUserId, this.profileData.uid);

        if (conversationId) {
            console.log('STARTCHAT - Conversazione ID ottenuta:', conversationId);
            this.router.navigate(['/chat', conversationId]);
        } else {
            console.error('STARTCHAT - getOrCreateConversation ha restituito un ID nullo o indefinito.');
            await this.presentFF7Alert('Impossibile avviare la chat.');
        }
    } catch (error) {
        console.error('STARTCHAT - Errore critico nel getOrCreateConversation o navigazione:', error);
        await this.presentFF7Alert('Errore nell\'avvio della chat. Riprova più tardi.');
    }
  }

  // Assicurati di disiscriverti dall'observer per evitare memory leaks
  ngOnDestroy(): void {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
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
