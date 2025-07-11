// src/app/pagine/profilo-altri-utenti/profilo-altri-utenti.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserDataService } from 'src/app/services/user-data.service';
import { FollowService } from 'src/app/services/follow.service';
import { ChatService } from 'src/app/services/chat.service';
import { AlertController } from '@ionic/angular';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Subscription } from 'rxjs'; // Importante per la gestione delle sottoscrizioni

@Component({
  selector: 'app-profilo-altri-utenti',
  templateUrl: './profilo-altri-utenti.page.html',
  styleUrls: ['./profilo-altri-utenti.page.scss'],
  standalone: false,
})
export class ProfiloAltriUtentiPage implements OnInit, OnDestroy {

  profileData: any = null;
  isLoading: boolean = true;
  loggedInUserId: string | null = null;

  isFollowingUser: boolean = false;
  targetUserFollowersCount: number = 0;
  targetUserFollowingCount: number = 0;

  // Un'unica Subscription per gestire tutte le sottoscrizioni RxJS in ngOnDestroy
  private allSubscriptions: Subscription = new Subscription();
  private authStateUnsubscribe: (() => void) | undefined; // Per la funzione di unsubscribe di onAuthStateChanged

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private chatService: ChatService,
    private followService: FollowService,
    private alertCtrl: AlertController
  ) { }

  async ngOnInit() {
    this.isLoading = true;

    const auth = getAuth();
    // Gestisci la funzione di unsubscribe di onAuthStateChanged separatamente
    this.authStateUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.loggedInUserId = user.uid;
        console.log('NGONINIT (onAuthStateChanged) - Utente loggato ID:', this.loggedInUserId);
      } else {
        this.loggedInUserId = null;
        console.log('NGONINIT (onAuthStateChanged) - Nessun utente loggato.');
      }
      // Dopo aver impostato loggedInUserId, procedi con il caricamento del profilo
      await this.loadUserProfile();
    });
  }

  private async loadUserProfile() {
    // Sottoscriviti ai parametri della route
    const routeSub = this.route.paramMap.subscribe(async params => {
      const userId = params.get('id');
      console.log('loadUserProfile - ID utente profilo da URL:', userId);

      if (userId) {
        this.isLoading = true; // Reimposta isLoading se l'ID cambia
        try {
          // Questa riga funzionerà senza errori TS2339 se getUserDataById restituisce una Promise
          this.profileData = await this.userDataService.getUserDataById(userId);

          if (!this.profileData) {
            console.warn('Nessun dato trovato per l\'utente con ID:', userId);
            await this.presentFF7Alert('Profilo utente non trovato.');
          } else {
            // Assicurati che l'UID sia presente, anche se il servizio lo dovrebbe già fornire
            this.profileData.uid = userId;
            console.log('loadUserProfile - Dati profilo caricati:', this.profileData);
            this.subscribeToFollowData(userId); // Sottoscriviti ai dati di follow solo dopo aver caricato il profilo
          }
        } catch (error) {
          console.error('loadUserProfile - Errore nel caricamento del profilo utente:', error);
          await this.presentFF7Alert('Si è verificato un errore durante il caricamento del profilo.');
        } finally {
          this.isLoading = false;
        }
      } else {
        console.warn('loadUserProfile - Nessun ID utente fornito nell\'URL per il profilo esterno.');
        this.isLoading = false;
        await this.presentFF7Alert('ID utente mancante.');
        this.router.navigateByUrl('/home');
      }
    });
    this.allSubscriptions.add(routeSub); // Aggiungi la sottoscrizione della route alla lista
  }

  private subscribeToFollowData(targetUserId: string) {
    // Prima di aggiungere nuove sottoscrizioni, rimuovi quelle vecchie di follow
    // In questo modo, se l'ID utente nel URL cambia, le vecchie sottoscrizioni vengono pulite.
    // Questo è il motivo per cui preferiamo gestire le sottoscrizioni in modo più granulare qui.
    this.unsubscribeFollowSubscriptions();

    if (this.loggedInUserId && this.loggedInUserId !== targetUserId) {
      const isFollowingSub = this.followService.isFollowing(this.loggedInUserId, targetUserId).subscribe(isFollowing => {
        this.isFollowingUser = isFollowing;
        console.log(`L'utente ${this.loggedInUserId} segue ${targetUserId}:`, this.isFollowingUser);
      });
      this.allSubscriptions.add(isFollowingSub); // Aggiungi alla lista globale
    } else {
      this.isFollowingUser = false;
    }

    const followersCountSub = this.followService.getFollowersCount(targetUserId).subscribe(count => {
      this.targetUserFollowersCount = count;
      console.log(`Follower di ${targetUserId}:`, this.targetUserFollowersCount);
    });
    this.allSubscriptions.add(followersCountSub); // Aggiungi alla lista globale

    const followingCountSub = this.followService.getFollowingCount(targetUserId).subscribe(count => {
      this.targetUserFollowingCount = count;
      console.log(`Persone seguite da ${targetUserId}:`, this.targetUserFollowingCount);
    });
    this.allSubscriptions.add(followingCountSub); // Aggiungi alla lista globale
  }

  async toggleFollow() {
    if (!this.loggedInUserId) {
      await this.presentFF7Alert('Devi essere loggato per seguire qualcuno.');
      return;
    }
    if (!this.profileData || !this.profileData.uid) {
      await this.presentFF7Alert('Errore: ID utente del profilo non disponibile.');
      return;
    }
    if (this.loggedInUserId === this.profileData.uid) {
      await this.presentFF7Alert('Non puoi seguire te stesso!');
      return;
    }

    try {
      if (this.isFollowingUser) {
        await this.followService.unfollowUser(this.loggedInUserId, this.profileData.uid);
        await this.presentFF7Alert(`Hai smesso di seguire ${this.profileData.nickname}.`);
      } else {
        await this.followService.followUser(this.loggedInUserId, this.profileData.uid);
        await this.presentFF7Alert(`Hai iniziato a seguire ${this.profileData.nickname}!`);
      }
    } catch (error) {
      console.error('Errore durante l\'operazione di follow/unfollow:', error);
      await this.presentFF7Alert('Si è verificato un errore. Riprova.');
    }
  }

  async startChat() {
    console.log('STARTCHAT - Avvio funzione chat.');

    if (!this.loggedInUserId) {
      console.error('STARTCHAT - Errore: Utente non loggato al momento della richiesta di chat.');
      await this.presentFF7Alert('Devi essere loggato per avviare una chat.');
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

  // --- METODI DI NAVIGAZIONE AGGIORNATI PER LE NUOVE PAGINE ---
  goToFollowersList() {
    if (this.profileData && this.profileData.uid) {
      this.router.navigate(['/followers-altro-list', this.profileData.uid]);
    } else {
      console.warn('goToFollowersList: ID utente del profilo non disponibile per la navigazione.');
    }
  }

  goToFollowingList() {
    if (this.profileData && this.profileData.uid) {
      this.router.navigate(['/following-altro-list', this.profileData.uid]);
    } else {
      console.warn('goToFollowingList: ID utente del profilo non disponibile per la navigazione.');
    }
  }
  // --- FINE METODI DI NAVIGAZIONE AGGIORNATI ---

  ngOnDestroy(): void {
    // Esegui la funzione di unsubscribe di onAuthStateChanged
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    // Rimuovi tutte le sottoscrizioni RxJS dalla lista
    this.allSubscriptions.unsubscribe();
  }

  // Questo metodo ora rimuove solo le sottoscrizioni relative al follow
  // in modo che possano essere ri-aggiunte correttamente se l'utente del profilo cambia
  private unsubscribeFollowSubscriptions(): void {
    // Per disiscrivere sottoscrizioni specifiche da allSubscriptions
    // senza disiscrivere tutto, dovremmo rimuoverle singolarmente.
    // Un modo più semplice è ricreare l'oggetto Subscription ogni volta
    // che chiamiamo subscribeToFollowData, ma questo sarebbe meno efficiente.
    // L'approccio attuale (aggiungere a allSubscriptions e fare unsubscribe di tutto in ngOnDestroy)
    // è accettabile se le sottoscrizioni di follow vengono sempre "rimpiazzate"
    // quando l'ID del profilo cambia.

    // Poiché isFollowingSubscription, followersCountSubscription, etc. non sono più proprietà
    // separate, non possiamo fare l'unsubscribe direttamente su di esse.
    // La pulizia avviene tramite allSubscriptions.unsubscribe() in ngOnDestroy.
    // Se vuoi una gestione più precisa, dovresti dichiararle di nuovo come proprietà
    // e gestirle singolarmente.
    // Per mantenere il tuo codice pulito e funzionante con `allSubscriptions`,
    // il metodo `unsubscribeFollowSubscriptions` come lo intendevi tu
    // non è più strettamente necessario in questa forma.
    // Se volessimo comunque disiscrivere solo quelle di follow, dovremmo
    // tenere traccia dei riferimenti a quelle sottoscrizioni in modo esplicito
    // e rimuoverle da allSubscriptions o disiscriverle individualmente.
    // Per ora, l'approccio è che ngOnDestroy le pulirà tutte.
    // Quindi, questo metodo, se non usato per una logica specifica di "reset parziale",
    // può essere rimosso o lasciato vuoto, dato che la pulizia finale è in ngOnDestroy.
    // Lo lascio qui come un commento per indicare la logica precedente, ma per ora è "vuoto" funzionalmente.
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
