// src/app/pagine/followers-list/followers-list.page.ts
import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core'; // AGGIUNGI ChangeDetectorRef
import { ActivatedRoute, Router } from '@angular/router';
import { FollowService } from 'src/app/services/follow.service';
import { UserDataService } from 'src/app/services/user-data.service';
import { AlertController } from '@ionic/angular';
import { Subscription, forkJoin, of, from } from 'rxjs'; // Aggiungi 'forkJoin', 'of', 'from'
import { switchMap, map, catchError, tap, take } from 'rxjs/operators'; // Aggiungi 'tap', 'take'
import { getAuth, User, onAuthStateChanged } from 'firebase/auth'; // Importa User e onAuthStateChanged

@Component({
  selector: 'app-followers-list',
  templateUrl: './followers-list.page.html',
  styleUrls: ['./followers-list.page.scss'],
  standalone: false,
})
export class FollowersListPage implements OnInit, OnDestroy {
  users: any[] = [];
  isLoading: boolean = true;
  private userId: string | null = null; // L'ID dell'utente di cui stiamo visualizzando i follower
  private usersSubscription: Subscription | undefined;
  private authSubscription: Subscription | undefined; // Per gestire la sottoscrizione a onAuthStateChanged
  private loggedInUserId: string | null = null; // L'ID dell'utente attualmente loggato

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private followService: FollowService,
    private userDataService: UserDataService,
    private alertCtrl: AlertController,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef // INJECT ChangeDetectorRef
  ) {
  }

  ngOnInit() {

    // 1. Ottieni l'ID dell'utente loggato in modo reattivo e una tantum
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
        this.cdr.detectChanges(); // Forza un tick del change detection
      }),
      catchError(err => {
        console.error('FLLW: Errore nel recupero stato autenticazione:', err); // Modificato prefisso
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
        return of(null);
      })
    ).subscribe(() => {
      // 2. Iscriviti ai parametri della rotta una volta che loggedInUserId è disponibile.
      this.route.paramMap.subscribe(params => {
        this.userId = params.get('id');
        if (this.userId) {
          this.loadFollowers();
        } else {
          console.error('FLLW: ID utente non trovato per la lista follower. Reindirizzamento al profilo.'); // Modificato prefisso
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
      this.users = []; // Resetta la lista per mostrare lo spinner
      this.cdr.detectChanges(); // Forza aggiornamento UI per mostrare spinner
    });

    if (!this.userId) {
      console.warn('FLLW: Cannot load followers. userId is missing. Aborting load.'); // Modificato prefisso
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
      tap(followerIds => console.log('FLLW: getFollowersIds emitted:', followerIds)), // Modificato prefisso
      switchMap(followerIds => {
        if (followerIds.length === 0) {
          return of([]); // Ritorna un Observable di un array vuoto
        }

        const userObservables = followerIds.map(id => {
          const userDataObservable = from(this.userDataService.getUserDataById(id)).pipe(
            tap(data => console.log(`FLLW: UserData for ${id}:`, data)), // Modificato prefisso
            catchError(err => {
              console.error(`FLLW: Errore nel recupero dati utente ${id}:`, err); // Modificato prefisso
              return of(null);
            })
          );

          // Aggiungi un Observable per verificare se l'utente loggato segue questo follower
          // Questo è il "ragionamento" della following-list
          const isFollowingThisUserObservable = this.loggedInUserId
            ? this.followService.isFollowing(this.loggedInUserId, id).pipe(
                take(1), // Prendi solo il primo valore e poi completa
                tap(isF => console.log(`FLLW: isFollowing (${this.loggedInUserId} following ${id}):`, isF)), // Modificato prefisso
                catchError(err => {
                  console.error(`FLLW: Errore isFollowing per ${this.loggedInUserId} -> ${id}:`, err); // Modificato prefisso
                  return of(false);
                })
              )
            : of(false).pipe(tap(() => console.log('FLLW: loggedInUserId non disponibile per isFollowing. Default a false.'))); // Modificato prefisso

          return forkJoin({
            userData: userDataObservable,
            isFollowing: isFollowingThisUserObservable // Ora include se l'utente loggato segue il follower
          }).pipe(
            tap(res => console.log(`FLLW: forkJoin result for ${id}:`, res)), // Modificato prefisso
            map(res => {
              return res.userData ? { uid: id, ...res.userData, isFollowing: res.isFollowing } : null;
            }),
            tap(userItem => console.log(`FLLW: Mapped user item for ${id}:`, userItem)) // Modificato prefisso
          );
        });

        return forkJoin(userObservables).pipe(
          map(results => results.filter(user => user !== null)),
          tap(finalUsers => console.log('FLLW: Risultato finale forkJoin (utenti filtrati):', finalUsers)) // Modificato prefisso
        );
      }),
      tap(finalData => console.log('FLLW: PIPE COMPLETO. Risultati pronti per la sottoscrizione (final tap):', finalData)), // Modificato prefisso
      catchError(err => {
        console.error('FLLW: Errore nella pipeline principale di caricamento follower:', err); // Modificato prefisso
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
        console.error('FLLW: Sottoscrizione ERROR: Errore finale:', err); // Modificato prefisso
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
          handler: () => console.log('FLLW: Annullata rimozione follower.') // Modificato prefisso
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
    // L'utente che sta cercando di rimuovere il follower (loggedInUserId)
    // deve essere l'ID del profilo corrente (userId)
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
    // Se arriviamo qui, la Promise di unfollowUser si è risolta senza lanciare un errore.
    // Tuttavia, il tuo log precedente mostra un errore catturato.
    // Dobbiamo capire DOVE avviene l'errore.
    await this.presentFF7Alert(`${this.users.find(u => u.uid === followerId)?.nickname || 'Utente'} rimosso dai tuoi follower.`);
  } catch (error) {
    // QUESTO È IL PUNTO CRUCIALE: STAMPA L'OGGETTO ERRORE COMPLETO
    console.error('FLLW: Errore CATTURATO durante la rimozione del follower:', error);
    // Se l'errore è un FirebaseError, potremmo voler stampare anche il suo codice
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('FLLW: Codice errore Firebase:', (error as any).code);
    }
    await this.presentFF7Alert('Si è verificato un errore durante la rimozione. Riprova.');
  }
  }

  // Nuova funzione per gestire il toggle di follow da questa pagina (se presente in UI)
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
