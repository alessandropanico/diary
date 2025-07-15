import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FollowService } from 'src/app/services/follow.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { AlertController } from '@ionic/angular';
import { Subscription, forkJoin, of, from } from 'rxjs';
import { switchMap, map, catchError, tap, take } from 'rxjs/operators';
import { getAuth, User, onAuthStateChanged } from 'firebase/auth';

@Component({
  selector: 'app-following-list',
  templateUrl: './following-list.page.html',
  styleUrls: ['./following-list.page.scss'],
  standalone: false,
})
export class FollowingListPage implements OnInit, OnDestroy {
  users: any[] = [];
  isLoading: boolean = true;
  private userId: string | null = null;
  private usersSubscription: Subscription | undefined;
  private authSubscription: Subscription | undefined;
  private loggedInUserId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private followService: FollowService,
    private userDataService: UserDataService,
    private alertCtrl: AlertController,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    console.log('FLL: Costruttore chiamato.');
  }

  ngOnInit() {
    console.log('FLL: ngOnInit chiamato.');

    this.authSubscription = from(
      new Promise<User | null>(resolve => {
        const unsubscribe = onAuthStateChanged(getAuth(), user => {
          unsubscribe();
          resolve(user);
        });
      })
    ).pipe(
      take(1),
      tap(user => {
        this.loggedInUserId = user ? user.uid : null;
        console.log('FLL: onAuthStateChanged (via from/take(1)) - loggedInUserId:', this.loggedInUserId);
        this.cdr.detectChanges();
      }),
      catchError(err => {
        console.error('FLL: Errore nel recupero stato autenticazione:', err);
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
        return of(null);
      })
    ).subscribe(() => {
      this.route.paramMap.subscribe(params => {
        this.userId = params.get('id');
        console.log('FLL: paramMap subscription - userId dal parametro:', this.userId);
        if (this.userId) {
          this.loadFollowing();
        } else {
          console.error('FLL: ID utente non trovato per la lista following. Reindirizzamento al profilo.');
          this.ngZone.run(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
          });
          this.router.navigateByUrl('/profilo');
        }
      });
    });
  }

  loadFollowing() {
    console.log('FLL: loadFollowing() chiamato. Current userId:', this.userId, 'loggedInUserId:', this.loggedInUserId);
    this.ngZone.run(() => {
      this.isLoading = true;
      this.users = [];
      console.log('FLL: isLoading impostato a true, users resettati.');
      this.cdr.detectChanges();
    });

    if (!this.userId) {
      console.warn('FLL: Cannot load following. userId is missing. Aborting load.');
      this.ngZone.run(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      });
      return;
    }

    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
      console.log('FLL: Sottoscrizione precedente annullata.');
    }

    this.usersSubscription = this.followService.getFollowingIds(this.userId!).pipe(
      tap(followingIds => console.log('FLL: getFollowingIds emitted:', followingIds)),
      switchMap(followingIds => {
        // --- QUI NON SERVE PIÙ FILTRARE! ---
        // Il tuo UsersService (ora FollowService) non dovrebbe più salvare l'ID dell'utente stesso.
        // Se c'è ancora un documento errato, è un residuo che va pulito dal DB.
        // Quindi, la riga qui sotto la potresti anche togliere, ma non fa male averla per sicurezza.
        const filteredFollowingIds = followingIds.filter(id => id !== this.loggedInUserId);
        console.log('FLL: followingIds filtrati (escluso loggedInUserId):', filteredFollowingIds);
        // --- FINE MODIFICA QUI ---


        if (filteredFollowingIds.length === 0) {
          console.log('FLL: Nessun ID seguito (dopo il filtro) trovato. Restituisco lista vuota.');
          return of([]);
        }

        const userObservables = filteredFollowingIds.map(id => {
          console.log('FLL: Mappatura ID:', id);
          const userDataObservable = from(this.userDataService.getUserDataById(id)).pipe(
            tap(data => console.log(`FLL: UserData for ${id}:`, data)),
            catchError(err => {
              console.error(`FLL: Errore nel recupero dati utente ${id}:`, err);
              return of(null);
            })
          );

          const isFollowingObservable = this.loggedInUserId
            ? this.followService.isFollowing(this.loggedInUserId, id).pipe(
                take(1),
                tap(isF => console.log(`FLL: isFollowing (${this.loggedInUserId} following ${id}):`, isF)),
                catchError(err => {
                  console.error(`FLL: Errore isFollowing per ${this.loggedInUserId} -> ${id}:`, err);
                  return of(false);
                })
              )
            : of(false).pipe(tap(() => console.log('FLL: loggedInUserId non disponibile per isFollowing. Default a false.')));

          return forkJoin({
            userData: userDataObservable,
            isFollowing: isFollowingObservable
          }).pipe(
            tap(res => console.log(`FLL: forkJoin result for ${id}:`, res)),
            map(res => {
              return res.userData ? { uid: id, ...res.userData, isFollowing: res.isFollowing } : null;
            }),
            tap(userItem => console.log(`FLL: Mapped user item for ${id}:`, userItem))
          );
        });

        console.log('FLL: Combinando tutti gli userObservables con forkJoin...');
        return forkJoin(userObservables).pipe(
          map(results => results.filter(user => user !== null)),
          tap(finalUsers => console.log('FLL: Risultato finale forkJoin (utenti filtrati):', finalUsers))
        );
      }),
      tap(finalData => console.log('FLL: PIPE COMPLETO. Risultati pronti per la sottoscrizione (final tap):', finalData)),
      catchError(err => {
        console.error('FLL: Errore nella pipeline principale di caricamento following:', err);
        this.ngZone.run(() => {
          this.isLoading = false;
          this.users = [];
          console.log('FLL: isLoading impostato a false a causa di errore principale, users resettati.');
          this.cdr.detectChanges();
        });
        this.presentFF7Alert('Errore nel caricamento dei seguiti. Riprova.');
        return of([]);
      })
    ).subscribe({
      next: (users: any[]) => {
        this.ngZone.run(() => {
          this.users = users;
          this.isLoading = false;
          console.log('FLL: Sottoscrizione NEXT: Utenti caricati:', this.users);
          console.log('FLL: isLoading impostato a false. Fine caricamento.');
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('FLL: Sottoscrizione ERROR: Errore finale:', err);
        this.ngZone.run(() => {
          this.isLoading = false;
          console.log('FLL: isLoading impostato a false a causa di errore nella sottoscrizione.');
          this.cdr.detectChanges();
        });
        this.presentFF7Alert('Errore grave nel caricamento dei seguiti.');
      },
      complete: () => {
        console.log('FLL: Sottoscrizione COMPLETA.');
        this.ngZone.run(() => {
          if (this.isLoading) {
            this.isLoading = false;
            console.log('FLL: Sottoscrizione COMPLETA: isLoading impostato a false (fallback).');
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  /**
   * Restituisce l'URL della foto profilo, usando un avatar di default
   * se l'URL fornito è nullo, vuoto, o un URL generico di Google.
   * @param photoUrl L'URL della foto profilo dell'utente.
   * @returns L'URL effettivo dell'immagine da visualizzare.
   */
  getUserPhoto(photoUrl: string | null | undefined): string {
    const defaultGoogleProfilePicture = 'https://lh3.googleusercontent.com/a/ACg8ocK-pW1q9zsWi1DHCcamHuNOTLOvotU44G2v2qtMUtWu3LI0FOE=s96-c';

    if (!photoUrl || photoUrl === '' || photoUrl === defaultGoogleProfilePicture) {
      return 'assets/immaginiGenerali/default-avatar.jpg';
    }
    return photoUrl;
  }
  // --- FINE FUNZIONE DA AGGIUNGERE ---

  async confirmToggleFollow(targetUserId: string, nickname: string, isCurrentlyFollowing: boolean) {
    console.log(`FLL: confirmToggleFollow chiamato per ${nickname}. isCurrentlyFollowing: ${isCurrentlyFollowing}`);
    const alert = await this.alertCtrl.create({
      cssClass: 'ff7-alert',
      header: isCurrentlyFollowing ? 'Smetti di seguire?' : 'Segui utente?',
      message: isCurrentlyFollowing ? `Sei sicuro di voler smettere di seguire ${nickname}?` : `Vuoi iniziare a seguire ${nickname}?`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel',
          cssClass: 'ff7-alert-button',
          handler: () => console.log('FLL: Annullato toggle follow.')
        },
        {
          text: isCurrentlyFollowing ? 'Smetti' : 'Segui',
          cssClass: isCurrentlyFollowing ? 'ff7-alert-button danger-button' : 'ff7-alert-button primary-button',
          handler: async () => {
            console.log(`FLL: Conferma toggle follow per ${nickname}.`);
            await this.toggleFollow(targetUserId, isCurrentlyFollowing);
          },
        },
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }

  async toggleFollow(targetUserId: string, isCurrentlyFollowing: boolean) {
    console.log(`FLL: toggleFollow chiamato. Target ID: ${targetUserId}, isCurrentlyFollowing: ${isCurrentlyFollowing}`);
    console.log('FLL: loggedInUserId:', this.loggedInUserId);

    if (!this.loggedInUserId) {
      await this.presentFF7Alert('Devi essere loggato per eseguire questa azione.');
      return;
    }
    // Prevenire il follow/unfollow di se stessi
    if (this.loggedInUserId === targetUserId) {
      await this.presentFF7Alert('Non puoi modificare lo stato di follow per te stesso qui.');
      return;
    }

    try {
      if (isCurrentlyFollowing) {
        console.log(`FLL: Chiamando unfollowUser(${this.loggedInUserId}, ${targetUserId})`);
        // Assumendo che followService.unfollowUser ora utilizzi la nuova logica per rimuovere il documento specifico.
        await this.followService.unfollowUser(this.loggedInUserId, targetUserId);
        await this.presentFF7Alert(`Hai smesso di seguire ${this.users.find(u => u.uid === targetUserId)?.nickname || 'Utente'}.`);
        console.log('FLL: unfollowUser completato.');
      } else {
        console.log(`FLL: Chiamando followUser(${this.loggedInUserId}, ${targetUserId})`);
        // Assumendo che followService.followUser ora utilizzi la nuova logica per creare il documento specifico.
        await this.followService.followUser(this.loggedInUserId, targetUserId);
        await this.presentFF7Alert(`Hai iniziato a seguire ${this.users.find(u => u.uid === targetUserId)?.nickname || 'Utente'}!`);
        console.log('FLL: followUser completato.');
      }
      // Dopo un follow/unfollow, ricarica la lista per assicurare la coerenza
      // Anche se l'onSnapshot del servizio potrebbe farlo, un refresh esplicito è più sicuro.
      this.loadFollowing(); // <-- Aggiunto questo per forzare il ricaricamento
    } catch (error) {
      console.error('FLL: Errore durante l\'operazione di follow/unfollow:', error);
      await this.presentFF7Alert('Si è verificato un errore. Riprova.');
    }
  }

  goToUserProfile(userId: string) {
    console.log('FLL: goToUserProfile chiamato per ID:', userId);
    if (userId === this.loggedInUserId) {
      console.log('FLL: Navigazione a /profilo (profilo proprio).');
      this.router.navigate(['/profilo']);
    } else {
      console.log('FLL: Navigazione a /profilo-altri-utenti/', userId);
      this.router.navigate(['/profilo-altri-utenti', userId]);
    }
  }

  async presentFF7Alert(message: string) {
    console.log('FLL: Presenting FF7 Alert:', message);
    const alert = await this.alertCtrl.create({
      cssClass: 'ff7-alert',
      header: 'Notifica',
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

  ngOnDestroy(): void {
    console.log('FLL: ngOnDestroy chiamato. Annullamento sottoscrizioni.');
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
      console.log('FLL: usersSubscription annullata.');
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      console.log('FLL: authSubscription annullata.');
    }
  }


}
