// src/app/pagine/profilo-altri-utenti/profilo-altri-utenti.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserDataService } from 'src/app/services/user-data.service';
import { FollowService } from 'src/app/services/follow.service';
import { ChatService } from 'src/app/services/chat.service';
import { AlertController } from '@ionic/angular';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
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

  private authStateSubscription: Subscription | undefined;
  private isFollowingSubscription: Subscription | undefined;
  private followersCountSubscription: Subscription | undefined;
  private followingCountSubscription: Subscription | undefined;

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
    this.authStateSubscription = new Subscription();

    this.authStateSubscription.add(onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.loggedInUserId = user.uid;
        console.log('NGONINIT (onAuthStateChanged) - Utente loggato ID:', this.loggedInUserId);
      } else {
        this.loggedInUserId = null;
        console.log('NGONINIT (onAuthStateChanged) - Nessun utente loggato.');
      }
      await this.loadUserProfile();
    }));
  }

  private async loadUserProfile() {
    this.route.paramMap.subscribe(async params => {
      const userId = params.get('id');
      console.log('loadUserProfile - ID utente profilo da URL:', userId);

      if (userId) {
        try {
          this.profileData = await this.userDataService.getUserDataById(userId);
          if (!this.profileData) {
            console.warn('Nessun dato trovato per l\'utente con ID:', userId);
            await this.presentFF7Alert('Profilo utente non trovato.');
          } else {
            this.profileData.uid = userId;
            console.log('loadUserProfile - Dati profilo caricati:', this.profileData);
            this.subscribeToFollowData(userId);
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
  }

  private subscribeToFollowData(targetUserId: string) {
    if (this.isFollowingSubscription) this.isFollowingSubscription.unsubscribe();
    if (this.followersCountSubscription) this.followersCountSubscription.unsubscribe();
    if (this.followingCountSubscription) this.followingCountSubscription.unsubscribe();

    if (this.loggedInUserId && this.loggedInUserId !== targetUserId) {
      this.isFollowingSubscription = this.followService.isFollowing(this.loggedInUserId, targetUserId).subscribe(isFollowing => {
        this.isFollowingUser = isFollowing;
        console.log(`L'utente ${this.loggedInUserId} segue ${targetUserId}:`, this.isFollowingUser);
      });
    } else {
      this.isFollowingUser = false;
    }

    this.followersCountSubscription = this.followService.getFollowersCount(targetUserId).subscribe(count => {
      this.targetUserFollowersCount = count;
      console.log(`Follower di ${targetUserId}:`, this.targetUserFollowersCount);
    });

    this.followingCountSubscription = this.followService.getFollowingCount(targetUserId).subscribe(count => {
      this.targetUserFollowingCount = count;
      console.log(`Persone seguite da ${targetUserId}:`, this.targetUserFollowingCount);
    });
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
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
    if (this.isFollowingSubscription) {
      this.isFollowingSubscription.unsubscribe();
    }
    if (this.followersCountSubscription) {
      this.followersCountSubscription.unsubscribe();
    }
    if (this.followingCountSubscription) {
      this.followingCountSubscription.unsubscribe();
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
