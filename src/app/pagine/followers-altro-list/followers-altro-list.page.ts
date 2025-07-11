// src/app/pages/followers-altro-list/followers-altro-list.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserDataService } from 'src/app/services/user-data.service';
import { FollowService } from 'src/app/services/follow.service';
import { Subscription } from 'rxjs';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

@Component({
  selector: 'app-followers-altro-list',
  templateUrl: './followers-altro-list.page.html',
  styleUrls: ['./followers-altro-list.page.scss'],
  standalone: false,
})
export class FollowersAltroListPage implements OnInit, OnDestroy {

  targetUserId: string | null = null; // L'ID dell'utente di cui stiamo mostrando i follower (dal parametro URL)
  loggedInUserId: string | null = null; // L'ID dell'utente attualmente loggato

  targetUserNickname: string = 'Caricamento...'; // Per il titolo dell'header
  followers: any[] = [];
  isLoading: boolean = true;
  backButtonHref: string = '/home'; // Default, verrà sovrascritto dinamicamente

  private followersSubscription: Subscription | undefined;
  private targetUserProfileSubscription: Subscription | undefined;
  private authStateUnsubscribe: (() => void) | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private followService: FollowService
  ) { }

  async ngOnInit() {
    // Ottieni l'utente loggato PRIMA di caricare i dati del profilo target
    const auth = getAuth();
    this.authStateUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        this.loggedInUserId = user.uid;
      } else {
        this.loggedInUserId = null;
      }
      // Dopo aver determinato loggedInUserId, procedi con il caricamento del profilo target
      this.loadFollowersOfTargetUser();
    });
  }

  private async loadFollowersOfTargetUser() {
    this.route.paramMap.subscribe(async params => {
      this.targetUserId = params.get('id'); // Recupera l'ID dell'utente dalla rotta

      if (this.targetUserId) {
        // Imposta il defaultHref per tornare al profilo dell'utente visualizzato
        // Se targetUserId è il tuo profilo, tornerà a /profilo, altrimenti a /profilo-altri-utenti/:id
        this.backButtonHref = (this.targetUserId === this.loggedInUserId) ?
                              '/profilo' : `/profilo-altri-utenti/${this.targetUserId}`;

        // 1. Carica i dati del profilo dell'utente TARGET per ottenere il nickname
        this.targetUserProfileSubscription = this.userDataService.getUserDataById(this.targetUserId).subscribe(userProfile => {
          if (userProfile && userProfile.nickname) {
            this.targetUserNickname = userProfile.nickname;
          } else {
            this.targetUserNickname = 'Utente Sconosciuto';
          }
        }, error => {
          console.error('Errore nel caricamento nickname utente target:', error);
          this.targetUserNickname = 'Errore';
        });

        // 2. Carica la lista dei follower dell'utente TARGET
        this.followersSubscription = this.followService.getFollowers(this.targetUserId).subscribe(
          users => {
            this.followers = users;
            this.isLoading = false;
            console.log(`Follower di ${this.targetUserId}:`, this.followers);
          },
          error => {
            console.error('Errore nel caricamento dei follower:', error);
            this.isLoading = false;
            // Potresti voler mostrare un messaggio all'utente
          }
        );
      } else {
        console.warn('ID utente target non fornito per la lista follower.');
        this.isLoading = false;
        this.router.navigateByUrl('/home'); // Reindirizza se l'ID manca
      }
    });
  }

  // Metodo per navigare al profilo di un utente della lista
  goToUserProfile(uid: string) {
    if (uid === this.loggedInUserId) {
      this.router.navigateByUrl('/profilo'); // Naviga al proprio profilo
    } else {
      this.router.navigateByUrl(`/profilo-altri-utenti/${uid}`); // Naviga al profilo di un altro utente
    }
  }

  ngOnDestroy(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    if (this.followersSubscription) {
      this.followersSubscription.unsubscribe();
    }
    if (this.targetUserProfileSubscription) {
      this.targetUserProfileSubscription.unsubscribe();
    }
  }
}
