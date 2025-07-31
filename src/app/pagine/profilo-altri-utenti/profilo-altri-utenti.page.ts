// src/app/pages/profilo-altri-utenti/profilo-altri-utenti.page.ts

import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserDataService } from 'src/app/services/user-data.service';
import { FollowService } from 'src/app/services/follow.service';
import { ChatService } from 'src/app/services/chat.service';
import { AlertController } from '@ionic/angular';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Subscription } from 'rxjs';
// ⭐ Importa ExpService e UserExpData ⭐
import { ExpService, UserExpData } from 'src/app/services/exp.service';

@Component({
  selector: 'app-profilo-altri-utenti',
  templateUrl: './profilo-altri-utenti.page.html',
  styleUrls: ['./profilo-altri-utenti.page.scss'],
  // Ricorda di impostare 'standalone: true' e aggiungere 'imports' se stai usando componenti standalone
  // Questo esempio mantiene 'standalone: false' come nel tuo codice fornito.
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

  private allSubscriptions: Subscription = new Subscription();
  private authStateUnsubscribe: (() => void) | undefined;

  // ⭐ Aggiungi le proprietà per i dati XP dell'utente target ⭐
  targetUserLevel: number = 0;
  targetUserXP: number = 0; // XP attuale nel livello
  targetXpForNextLevel: number = 0; // XP mancanti al prossimo livello
  targetXpPercentage: number = 0; // Percentuale di progresso nel livello
  // ⭐ FINE proprietà XP ⭐

  // ⭐ NOVITÀ: Proprietà per gestire lo switch tra Post e Dashboard ⭐
  selectedSegment: 'posts' | 'dashboard' = 'posts'; // Default a 'posts'

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private chatService: ChatService,
    private followService: FollowService,
    private alertCtrl: AlertController,
    private ngZone: NgZone,
    // ⭐ Inietta ExpService ⭐
    private expService: ExpService,
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    this.isLoadingStats = true;

    const auth = getAuth();
    this.authStateUnsubscribe = onAuthStateChanged(auth, async (user) => {
      this.ngZone.run(async () => {
        if (user) {
          this.loggedInUserId = user.uid;
        } else {
          this.loggedInUserId = null;
        }
        await this.loadUserProfile();
      });
    });
  }

  private async loadUserProfile() {
    this.isLoadingStats = true;
    this.unsubscribeFollowCounts();

    const routeSub = this.route.paramMap.subscribe(async params => {
      const userId = params.get('id');

      if (userId) {
        this.isLoading = true;
        try {
          // Recupera i dati del profilo, che ora dovrebbero includere totalXP
          this.profileData = await this.userDataService.getUserDataById(userId);

          if (!this.profileData) {
            console.warn('Nessun dato trovato per l\'utente con ID:', userId);
            await this.presentFF7Alert('Profilo utente non trovato.');
          } else {
            this.profileData.uid = userId;
            this.subscribeToFollowData(userId);

            // ⭐ Gestione dell'XP dell'utente target ⭐
            const totalXPFromProfile = this.profileData.totalXP || 0; // Recupera totalXP (default 0 se non esiste)
            // Calcola i dati del livello usando il metodo pubblico di ExpService
            const expData: UserExpData = this.expService.calculateLevelAndProgress(totalXPFromProfile);

            this.targetUserLevel = expData.userLevel;
            this.targetUserXP = expData.currentXP;
            this.targetXpForNextLevel = expData.xpForNextLevel;
            this.targetXpPercentage = expData.progressPercentage;
            // ⭐ FINE Gestione dell'XP dell'utente target ⭐
          }
        } catch (error) {
          console.error('loadUserProfile - Errore nel caricamento del profilo utente:', error);
          await this.presentFF7Alert('Si è verificato un errore durante il caricamento del profilo.');
          this.isLoadingStats = false;
        } finally {
          this.isLoading = false;
        }
      } else {
        console.warn('loadUserProfile - Nessun ID utente fornito nell\'URL per il profilo esterno.');
        this.isLoading = false;
        this.isLoadingStats = false;
        await this.presentFF7Alert('ID utente mancante.');
        this.router.navigateByUrl('/home');
      }
    });
    this.allSubscriptions.add(routeSub);
  }

  private subscribeToFollowData(targetUserId: string) {
    this.isLoadingStats = true;
    this.unsubscribeFollowCounts();

    let loadedCount = 0;

    const checkCompletion = () => {
      loadedCount++;
      if (loadedCount === (this.loggedInUserId && this.loggedInUserId !== targetUserId ? 3 : 2)) {
        this.ngZone.run(() => {
          this.isLoadingStats = false;
        });
      }
    };

    if (this.loggedInUserId && this.loggedInUserId !== targetUserId) {
      const isFollowingSub = this.followService.isFollowing(this.loggedInUserId, targetUserId).subscribe(isFollowing => {
        this.ngZone.run(() => {
          this.isFollowingUser = isFollowing;
          checkCompletion();
        });
      }, error => {
        console.error('Errore isFollowing:', error);
        checkCompletion();
      });
      this.allSubscriptions.add(isFollowingSub);
    } else {
      checkCompletion();
    }

    this.followersSub = this.followService.getFollowersCount(targetUserId).subscribe(count => {
      this.ngZone.run(() => {
        this.targetUserFollowersCount = count;
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

    try {
      const conversationId = await this.chatService.getOrCreateConversation(this.loggedInUserId, this.profileData.uid);

      if (conversationId) {
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

  ngOnDestroy(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    this.allSubscriptions.unsubscribe();
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

  getUserPhoto(photoUrl: string | null | undefined): string {
    const defaultGoogleProfilePicture = 'https://lh3.googleusercontent.com/a/ACg8ocK-pW1q9zsWi1DHCcamHuNOTLOvotU44G2v2qtMUtWu3LI0FOE=s96-c';

    if (!photoUrl || photoUrl === '' || photoUrl === defaultGoogleProfilePicture) {
      return 'assets/immaginiGenerali/default-avatar.jpg';
    }
    return photoUrl;
  }
}
