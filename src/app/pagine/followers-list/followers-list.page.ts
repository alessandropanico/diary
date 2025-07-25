import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FollowService } from 'src/app/services/follow.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { AlertController } from '@ionic/angular';
import { Subscription, forkJoin, of, from } from 'rxjs';
import { switchMap, map, catchError, tap, take } from 'rxjs/operators';
import { getAuth, User, onAuthStateChanged } from 'firebase/auth';

@Component({
  selector: 'app-followers-list',
  templateUrl: './followers-list.page.html',
  styleUrls: ['./followers-list.page.scss'],
  standalone: false,
})
export class FollowersListPage implements OnInit, OnDestroy {
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
  }

  ngOnInit() {

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
        this.cdr.detectChanges();
      }),
      catchError(err => {
        console.error('FLLW: Errore nel recupero stato autenticazione:', err);
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
        return of(null);
      })
    ).subscribe(() => {
      this.route.paramMap.subscribe(params => {
        this.userId = params.get('id');
        if (this.userId) {
          this.loadFollowers();
        } else {
          console.error('FLLW: ID utente non trovato per la lista follower. Reindirizzamento al profilo.');
          this.ngZone.run(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
          });
          this.router.navigateByUrl('/profilo');
        }
      });
    });
  }

  loadFollowers() {
    this.ngZone.run(() => {
      this.isLoading = true;
      this.users = [];
      this.cdr.detectChanges();
    });

    if (!this.userId) {
      console.warn('FLLW: Cannot load followers. userId is missing. Aborting load.');
      this.ngZone.run(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      });
      return;
    }

    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }

    this.usersSubscription = this.followService.getFollowersIds(this.userId!).pipe(
      tap(followerIds => console.log('FLLW: getFollowersIds emitted:', followerIds)),
      switchMap(followerIds => {
        if (followerIds.length === 0) {
          return of([]);
        }

        const userObservables = followerIds.map(id => {
          const userDataObservable = from(this.userDataService.getUserDataById(id)).pipe(
            tap(data => console.log(`FLLW: UserData for ${id}:`, data)),
            catchError(err => {
              console.error(`FLLW: Errore nel recupero dati utente ${id}:`, err);
              return of(null);
            })
          );

          const isFollowingThisUserObservable = this.loggedInUserId
            ? this.followService.isFollowing(this.loggedInUserId, id).pipe(
                take(1),
                tap(isF => console.log(`FLLW: isFollowing (${this.loggedInUserId} following ${id}):`, isF)),
                catchError(err => {
                  console.error(`FLLW: Errore isFollowing per ${this.loggedInUserId} -> ${id}:`, err);
                  return of(false);
                })
              )
            : of(false).pipe(tap(() => console.log('FLLW: loggedInUserId non disponibile per isFollowing. Default a false.')));

          return forkJoin({
            userData: userDataObservable,
            isFollowing: isFollowingThisUserObservable
          }).pipe(
            tap(res => console.log(`FLLW: forkJoin result for ${id}:`, res)),
            map(res => {
              return res.userData ? { uid: id, ...res.userData, isFollowing: res.isFollowing } : null;
            }),
            tap(userItem => console.log(`FLLW: Mapped user item for ${id}:`, userItem))
          );
        });

        return forkJoin(userObservables).pipe(
          map(results => results.filter(user => user !== null)),
          tap(finalUsers => console.log('FLLW: Risultato finale forkJoin (utenti filtrati):', finalUsers))
        );
      }),
      tap(finalData => console.log('FLLW: PIPE COMPLETO. Risultati pronti per la sottoscrizione (final tap):', finalData)),
      catchError(err => {
        console.error('FLLW: Errore nella pipeline principale di caricamento follower:', err);
        this.ngZone.run(() => {
          this.isLoading = false;
          this.users = [];
          this.cdr.detectChanges();
        });
        this.presentFF7Alert('Errore nel caricamento dei follower. Riprova.');
        return of([]);
      })
    ).subscribe({
      next: (users: any[]) => {
        this.ngZone.run(() => {
          this.users = users;
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('FLLW: Sottoscrizione ERROR: Errore finale:', err);
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
        this.presentFF7Alert('Errore grave nel caricamento dei follower.');
      },
      complete: () => {
        this.ngZone.run(() => {
          if (this.isLoading) {
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  async confirmRemoveFollower(followerId: string, nickname: string) {
    const alert = await this.alertCtrl.create({
      cssClass: 'ff7-alert',
      header: 'Conferma Rimozione',
      message: `Sei sicuro di voler rimuovere ${nickname} dai tuoi follower?`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel',
          cssClass: 'ff7-alert-button',
          handler: () => console.log('FLLW: Annullata rimozione follower.')
        },
        {
          text: 'Rimuovi',
          cssClass: 'ff7-alert-button danger-button',
          handler: async () => {
            await this.removeFollower(followerId);
          },
        },
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }

  async removeFollower(followerId: string) {

    if (!this.loggedInUserId) {
      await this.presentFF7Alert('Devi essere loggato per eseguire questa azione.');
      return;
    }
    if (this.loggedInUserId !== this.userId) {
        await this.presentFF7Alert('Non puoi rimuovere follower dal profilo di un altro utente.');
        return;
    }
    if (followerId === this.loggedInUserId) {
      await this.presentFF7Alert('Non puoi rimuovere te stesso dai tuoi follower.');
      return;
    }


     try {
    await this.followService.unfollowUser(followerId, this.loggedInUserId);
    await this.presentFF7Alert(`${this.users.find(u => u.uid === followerId)?.nickname || 'Utente'} rimosso dai tuoi follower.`);
  } catch (error) {
    console.error('FLLW: Errore CATTURATO durante la rimozione del follower:', error);
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('FLLW: Codice errore Firebase:', (error as any).code);
    }
    await this.presentFF7Alert('Si è verificato un errore durante la rimozione. Riprova.');
  }
  }

  async toggleFollowFromFollowersList(targetUserId: string, isCurrentlyFollowing: boolean) {
    if (!this.loggedInUserId) {
        await this.presentFF7Alert('Devi essere loggato per eseguire questa azione.');
        return;
    }
    if (this.loggedInUserId === targetUserId) {
        await this.presentFF7Alert('Non puoi seguire/smettere di seguire te stesso.');
        return;
    }

    try {
        if (isCurrentlyFollowing) {
            await this.followService.unfollowUser(this.loggedInUserId, targetUserId);
            await this.presentFF7Alert(`Hai smesso di seguire ${this.users.find(u => u.uid === targetUserId)?.nickname || 'Utente'}.`);
        } else {
            await this.followService.followUser(this.loggedInUserId, targetUserId);
            await this.presentFF7Alert(`Hai iniziato a seguire ${this.users.find(u => u.uid === targetUserId)?.nickname || 'Utente'}!`);
        }
    } catch (error) {
        console.error('FLLW: Errore durante l\'operazione di follow/unfollow dal followers list:', error);
        await this.presentFF7Alert('Si è verificato un errore. Riprova.');
    }
  }


  goToUserProfile(userId: string) {
    if (userId === this.loggedInUserId) {
      this.router.navigate(['/profilo']);
    } else {
      this.router.navigate(['/profilo-altri-utenti', userId]);
    }
  }

  async presentFF7Alert(message: string) {
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
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
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
}
