import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FollowService } from 'src/app/services/follow.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

@Component({
  selector: 'app-followers-altro-list',
  templateUrl: './followers-altro-list.page.html',
  styleUrls: ['./followers-altro-list.page.scss'],
  standalone: false,
})
export class FollowersAltroListPage implements OnInit, OnDestroy {
  targetUserId: string | null = null;
  followers: any[] = [];
  isLoading: boolean = true;
  loggedInUserId: string | null = null;

  private allSubscriptions: Subscription = new Subscription();
  private authStateUnsubscribe: (() => void) | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private followService: FollowService,
    private userDataService: UserDataService,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    this.isLoading = true;

    const auth = getAuth();
    this.authStateUnsubscribe = onAuthStateChanged(auth, (user) => {
      this.ngZone.run(() => {
        this.loggedInUserId = user ? user.uid : null;
        this.loadFollowersList();
      });
    });
  }

  private loadFollowersList() {
    const routeSub = this.route.paramMap.subscribe(async params => {
      this.targetUserId = params.get('id');

      if (this.targetUserId) {
        this.isLoading = true;

        this.allSubscriptions.add(
          this.followService.getFollowersIds(this.targetUserId).subscribe(async followerIds => {
            const loadedFollowers: any[] = [];
            for (const followerId of followerIds) {
              try {
                const userData = await this.userDataService.getUserDataById(followerId);
                if (userData) {
                  loadedFollowers.push({ uid: followerId, ...userData });
                }
              } catch (error) {
                console.error('Errore nel caricare i dati del follower:', followerId, error);
              }
            }
            this.ngZone.run(() => {
              this.followers = loadedFollowers;
              this.isLoading = false;
            });
          }, error => {
            console.error('Errore nel recupero degli ID follower:', error);
            this.ngZone.run(() => {
              this.isLoading = false;
            });
          })
        );
      } else {
        console.warn('FollowersAltroListPage: ID utente mancante nella rotta.');
        this.isLoading = false;
      }
    });
    this.allSubscriptions.add(routeSub);
  }

  ngOnDestroy(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    this.allSubscriptions.unsubscribe();
  }

  /**
   * Naviga al profilo dell'utente cliccato.
   * Se l'ID cliccato corrisponde all'ID dell'utente attualmente loggato,
   * reindirizza alla pagina del proprio profilo (`/profilo`).
   * Altrimenti, reindirizza alla pagina del profilo di altri utenti (`/profilo-altri-utenti/:id`).
   * @param userId L'ID dell'utente di cui visualizzare il profilo.
   */
  goToUserProfile(userId: string) {
    if (userId && this.loggedInUserId && userId === this.loggedInUserId) {
      this.router.navigate(['/profilo']);
    } else if (userId) {
      this.router.navigate(['/profilo-altri-utenti', userId]);
    } else {
      console.warn('goToUserProfile: ID utente non valido o mancante.');
    }
  }
}
