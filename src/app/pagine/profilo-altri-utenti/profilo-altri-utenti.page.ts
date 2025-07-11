import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserDataService } from 'src/app/services/user-data.service';
import { FollowService } from 'src/app/services/follow.service';
import { ChatService } from 'src/app/services/chat.service';
import { AlertController } from '@ionic/angular';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Subscription } from 'rxjs';

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

  isLoadingStats: boolean = true;
  private followersSub: Subscription | undefined;
  private followingSub: Subscription | undefined;

  // Un'unica Subscription per gestire tutte le sottoscrizioni RxJS in ngOnDestroy
  private allSubscriptions: Subscription = new Subscription();
  private authStateUnsubscribe: (() => void) | undefined; // Per la funzione di unsubscribe di onAuthStateChanged

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private chatService: ChatService,
    private followService: FollowService,
    private alertCtrl: AlertController,
    private ngZone: NgZone,
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    this.isLoadingStats = true; // Inizializza a true anche qui

    const auth = getAuth();
    this.authStateUnsubscribe = onAuthStateChanged(auth, async (user) => {
      this.ngZone.run(async () => { // Assicurati che gli aggiornamenti avvengano nell'Angular zone
        if (user) {
          this.loggedInUserId = user.uid;
          console.log('NGONINIT (onAuthStateChanged) - Utente loggato ID:', this.loggedInUserId);
        } else {
          this.loggedInUserId = null;
          console.log('NGONINIT (onAuthStateChanged) - Nessun utente loggato.');
        }
        await this.loadUserProfile();
      });
    });
  }

  private async loadUserProfile() {
    // Prima di caricare un nuovo profilo, reimposta isLoadingStats
    this.isLoadingStats = true;

    // Unsubscribe dalle vecchie sottoscrizioni di follow prima di aggiungerne di nuove
    this.unsubscribeFollowCounts();

    const routeSub = this.route.paramMap.subscribe(async params => {
      const userId = params.get('id');
      console.log('loadUserProfile - ID utente profilo da URL:', userId);

      if (userId) {
        this.isLoading = true;
        try {
          this.profileData = await this.userDataService.getUserDataById(userId);

          if (!this.profileData) {
            console.warn('Nessun dato trovato per l\'utente con ID:', userId);
            await this.presentFF7Alert('Profilo utente non trovato.');
          } else {
            this.profileData.uid = userId;
            console.log('loadUserProfile - Dati profilo caricati:', this.profileData);
            this.subscribeToFollowData(userId); // Sottoscriviti ai dati di follow
          }
        } catch (error) {
          console.error('loadUserProfile - Errore nel caricamento del profilo utente:', error);
          await this.presentFF7Alert('Si è verificato un errore durante il caricamento del profilo.');
          this.isLoadingStats = false; // In caso di errore nel profilo, nascondi anche le stats
        } finally {
          this.isLoading = false;
        }
      } else {
        console.warn('loadUserProfile - Nessun ID utente fornito nell\'URL per il profilo esterno.');
        this.isLoading = false;
        this.isLoadingStats = false; // Se non c'è ID, non c'è nulla da caricare
        await this.presentFF7Alert('ID utente mancante.');
        this.router.navigateByUrl('/home');
      }
    });
    this.allSubscriptions.add(routeSub);
  }

  private subscribeToFollowData(targetUserId: string) {
    this.isLoadingStats = true; // Inizia il caricamento delle stats
    this.unsubscribeFollowCounts(); // Assicurati di pulire le precedenti sottoscrizioni

    let loadedCount = 0; // Contatore per il completamento delle sottoscrizioni

    const checkCompletion = () => {
      loadedCount++;
      if (loadedCount === (this.loggedInUserId && this.loggedInUserId !== targetUserId ? 3 : 2)) {
        // 3 se controlliamo isFollowing, 2 altrimenti
        this.ngZone.run(() => {
          this.isLoadingStats = false;
          console.log('ProfiloAltriUtentiPage: Statistiche follower/following caricate.');
        });
      }
    };

    if (this.loggedInUserId && this.loggedInUserId !== targetUserId) {
      const isFollowingSub = this.followService.isFollowing(this.loggedInUserId, targetUserId).subscribe(isFollowing => {
        this.ngZone.run(() => { // Esegui nel contesto di Angular
          this.isFollowingUser = isFollowing;
          console.log(`L'utente ${this.loggedInUserId} segue ${targetUserId}:`, this.isFollowingUser);
          checkCompletion();
        });
      }, error => {
        console.error('Errore isFollowing:', error);
        checkCompletion();
      });
      this.allSubscriptions.add(isFollowingSub);
    } else {
      // Se non si controlla isFollowing, il conteggio iniziale sarà 0 o 1 (a seconda di come gestisci isFollowing nel checkCompletion)
      // Per semplificare, assumiamo che se non c'è loggedInUserId o è lo stesso utente, isFollowing è false e la "sottoscrizione" è completa.
      checkCompletion(); // Simula il completamento della sottoscrizione isFollowing
    }

    this.followersSub = this.followService.getFollowersCount(targetUserId).subscribe(count => {
      this.ngZone.run(() => {
        this.targetUserFollowersCount = count;
        console.log(`Follower di ${targetUserId}:`, this.targetUserFollowersCount);
        checkCompletion();
      });
    }, error => {
      console.error('Errore getFollowersCount:', error);
      this.ngZone.run(() => {
        this.targetUserFollowersCount = 0;
        checkCompletion();
      });
    });
    this.allSubscriptions.add(this.followersSub);

    this.followingSub = this.followService.getFollowingCount(targetUserId).subscribe(count => {
      this.ngZone.run(() => {
        this.targetUserFollowingCount = count;
        console.log(`Persone seguite da ${targetUserId}:`, this.targetUserFollowingCount);
        checkCompletion();
      });
    }, error => {
      console.error('Errore getFollowingCount:', error);
      this.ngZone.run(() => {
        this.targetUserFollowingCount = 0;
        checkCompletion();
      });
    });
    this.allSubscriptions.add(this.followingSub);
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

  private unsubscribeFollowCounts(): void {
    if (this.followersSub) {
      this.followersSub.unsubscribe();
      this.followersSub = undefined;
    }
    if (this.followingSub) {
      this.followingSub.unsubscribe();
      this.followingSub = undefined;
    }
    // L'isFollowingSub non è più una proprietà separata, è aggiunta a allSubscriptions.
    // L'approccio attuale con `loadedCount` e `checkCompletion` gestirà questo implicitamente
    // quando `subscribeToFollowData` viene chiamato di nuovo.
  }
}
