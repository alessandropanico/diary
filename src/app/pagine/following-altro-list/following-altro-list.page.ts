// src/app/pagine/following-altro-list/following-altro-list.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core'; // Aggiunto OnDestroy
import { ActivatedRoute } from '@angular/router';
import { FollowService } from 'src/app/services/follow.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { Subscription } from 'rxjs'; // Importante per la gestione delle sottoscrizioni

@Component({
  selector: 'app-following-altro-list',
  templateUrl: './following-altro-list.page.html',
  styleUrls: ['./following-altro-list.page.scss'],
  standalone: false,
})
export class FollowingAltroListPage implements OnInit, OnDestroy { // Implementa OnDestroy
  targetUserId: string | null = null;
  following: any[] = [];
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
      console.log('FollowingAltroListPage: ID utente del profilo:', this.targetUserId);

      if (this.targetUserId) {
        // *** CORREZIONE QUI: Usa getFollowingIds invece di getFollowing ***
        const followingIdsSub = this.followService.getFollowingIds(this.targetUserId).subscribe(async followingIds => {
          console.log('FollowingAltroListPage: ID persone seguite raw:', followingIds);
          const loadedFollowing = [];
          for (const followingId of followingIds) {
            try {
              const userData = await this.userDataService.getUserDataById(followingId);
              if (userData) {
                loadedFollowing.push(userData);
              }
            } catch (error) {
              console.error('Errore nel caricare i dati della persona seguita:', followingId, error);
            }
          }
          this.following = loadedFollowing;
          this.isLoading = false;
          console.log('FollowingAltroListPage: Persone seguite caricate:', this.following);
        }, error => {
          console.error('Errore nel recupero degli ID persone seguite:', error);
          this.isLoading = false;
        });
        this.allSubscriptions.add(followingIdsSub); // Aggiungi alla lista delle sottoscrizioni
      } else {
        console.warn('FollowingAltroListPage: ID utente mancante nella rotta.');
        this.isLoading = false;
      }
    });
    this.allSubscriptions.add(routeSub); // Aggiungi la sottoscrizione della route
  }

  ngOnDestroy(): void {
    this.allSubscriptions.unsubscribe(); // Pulisci tutte le sottoscrizioni
  }
}
