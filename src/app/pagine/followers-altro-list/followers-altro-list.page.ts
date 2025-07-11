// src/app/pagine/followers-altro-list/followers-altro-list.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core'; // Aggiunto OnDestroy
import { ActivatedRoute } from '@angular/router';
import { FollowService } from 'src/app/services/follow.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs'; // Importante per la gestione delle sottoscrizioni

@Component({
  selector: 'app-followers-altro-list',
  templateUrl: './followers-altro-list.page.html',
  styleUrls: ['./followers-altro-list.page.scss'],
  standalone: false,
})
export class FollowersAltroListPage implements OnInit, OnDestroy { // Implementa OnDestroy
  targetUserId: string | null = null;
  followers: any[] = [];
  isLoading: boolean = true;

  private allSubscriptions: Subscription = new Subscription(); // Gestore delle sottoscrizioni

  constructor(
    private route: ActivatedRoute,
    private followService: FollowService,
    private userDataService: UserDataService
  ) { }

  ngOnInit() {
    this.isLoading = true;
    const routeSub = this.route.paramMap.subscribe(async params => {
      this.targetUserId = params.get('id');
      console.log('FollowersAltroListPage: ID utente del profilo:', this.targetUserId);

      if (this.targetUserId) {
        // *** CORREZIONE QUI: Usa getFollowersIds invece di getFollowers ***
        const followersIdsSub = this.followService.getFollowersIds(this.targetUserId).subscribe(async followerIds => {
          console.log('FollowersAltroListPage: ID follower raw:', followerIds);
          const loadedFollowers = [];
          for (const followerId of followerIds) {
            try {
              // Assicurati che getUserDataById nel tuo UserDataService restituisca una Promise<any | null>
              const userData = await this.userDataService.getUserDataById(followerId);
              if (userData) {
                loadedFollowers.push(userData);
              }
            } catch (error) {
              console.error('Errore nel caricare i dati del follower:', followerId, error);
            }
          }
          this.followers = loadedFollowers;
          this.isLoading = false;
          console.log('FollowersAltroListPage: Follower caricati:', this.followers);
        }, error => {
          console.error('Errore nel recupero degli ID follower:', error);
          this.isLoading = false;
        });
        this.allSubscriptions.add(followersIdsSub); // Aggiungi alla lista delle sottoscrizioni
      } else {
        console.warn('FollowersAltroListPage: ID utente mancante nella rotta.');
        this.isLoading = false;
      }
    });
    this.allSubscriptions.add(routeSub); // Aggiungi la sottoscrizione della route
  }

  ngOnDestroy(): void {
    this.allSubscriptions.unsubscribe(); // Pulisci tutte le sottoscrizioni
  }
}
