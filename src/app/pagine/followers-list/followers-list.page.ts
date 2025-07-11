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
    console.log('FLLW: Costruttore chiamato.'); // Modificato prefisso per chiarezza
  }

  ngOnInit() {
    console.log('FLLW: ngOnInit chiamato.'); // Modificato prefisso

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
        console.log('FLLW: onAuthStateChanged (via from/take(1)) - loggedInUserId:', this.loggedInUserId); // Modificato prefisso
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
        console.log('FLLW: paramMap subscription - userId dal parametro:', this.userId); // Modificato prefisso
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
    console.log('FLLW: loadFollowers() chiamato. Current userId:', this.userId, 'loggedInUserId:', this.loggedInUserId); // Modificato prefisso
    this.ngZone.run(() => {
      this.isLoading = true;
      this.users = []; // Resetta la lista per mostrare lo spinner
      console.log('FLLW: isLoading impostato a true, users resettati.'); // Modificato prefisso
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
      console.log('FLLW: Sottoscrizione precedente annullata.'); // Modificato prefisso
    }

    this.usersSubscription = this.followService.getFollowersIds(this.userId!).pipe(
      tap(followerIds => console.log('FLLW: getFollowersIds emitted:', followerIds)), // Modificato prefisso
      switchMap(followerIds => {
        if (followerIds.length === 0) {
          console.log('FLLW: Nessun ID follower trovato. Restituisco lista vuota.'); // Modificato prefisso
          return of([]); // Ritorna un Observable di un array vuoto
        }

        const userObservables = followerIds.map(id => {
          console.log('FLLW: Mappatura ID:', id); // Modificato prefisso
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

        console.log('FLLW: Combinando tutti gli userObservables con forkJoin...'); // Modificato prefisso
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
          console.log('FLLW: isLoading impostato a false a causa di errore principale, users resettati.'); // Modificato prefisso
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
          console.log('FLLW: Sottoscrizione NEXT: Utenti caricati:', this.users); // Modificato prefisso
          console.log('FLLW: isLoading impostato a false. Fine caricamento.'); // Modificato prefisso
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('FLLW: Sottoscrizione ERROR: Errore finale:', err); // Modificato prefisso
        this.ngZone.run(() => {
          this.isLoading = false;
          console.log('FLLW: isLoading impostato a false a causa di errore nella sottoscrizione.'); // Modificato prefisso
          this.cdr.detectChanges();
        });
        this.presentFF7Alert('Errore grave nel caricamento dei follower.');
      },
      complete: () => {
        console.log('FLLW: Sottoscrizione COMPLETA.'); // Modificato prefisso
        this.ngZone.run(() => {
          if (this.isLoading) {
            this.isLoading = false;
            console.log('FLLW: Sottoscrizione COMPLETA: isLoading impostato a false (fallback).'); // Modificato prefisso
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  async confirmRemoveFollower(followerId: string, nickname: string) {
    console.log(`FLLW: confirmRemoveFollower chiamato per ${nickname}.`); // Modificato prefisso
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
            console.log(`FLLW: Conferma rimozione follower per ${nickname}.`); // Modificato prefisso
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
    console.log(`FLLW: removeFollower chiamato. Follower ID da rimuovere: ${followerId}.`); // Modificato prefisso
    console.log('FLLW: loggedInUserId (tuo ID):', this.loggedInUserId); // Modificato prefisso

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
    console.log(`FLLW: Chiamando unfollowUser(${followerId}, ${this.loggedInUserId}) per rimuovere il follower.`);
    await this.followService.unfollowUser(followerId, this.loggedInUserId);
    // Se arriviamo qui, la Promise di unfollowUser si è risolta senza lanciare un errore.
    // Tuttavia, il tuo log precedente mostra un errore catturato.
    // Dobbiamo capire DOVE avviene l'errore.
    await this.presentFF7Alert(`${this.users.find(u => u.uid === followerId)?.nickname || 'Utente'} rimosso dai tuoi follower.`);
    console.log('FLLW: unfollowUser per rimozione follower completato.');
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
    console.log(`FLLW: toggleFollowFromFollowersList chiamato per ${targetUserId}. isCurrentlyFollowing: ${isCurrentlyFollowing}`);
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
            console.log(`FLLW: Chiamando unfollowUser(${this.loggedInUserId}, ${targetUserId})`);
            await this.followService.unfollowUser(this.loggedInUserId, targetUserId);
            await this.presentFF7Alert(`Hai smesso di seguire ${this.users.find(u => u.uid === targetUserId)?.nickname || 'Utente'}.`);
            console.log('FLLW: unfollowUser completato.');
        } else {
            console.log(`FLLW: Chiamando followUser(${this.loggedInUserId}, ${targetUserId})`);
            await this.followService.followUser(this.loggedInUserId, targetUserId);
            await this.presentFF7Alert(`Hai iniziato a seguire ${this.users.find(u => u.uid === targetUserId)?.nickname || 'Utente'}!`);
            console.log('FLLW: followUser completato.');
        }
        // La lista si aggiornerà automaticamente grazie all'onSnapshot e alla reattività del pipe
    } catch (error) {
        console.error('FLLW: Errore durante l\'operazione di follow/unfollow dal followers list:', error);
        await this.presentFF7Alert('Si è verificato un errore. Riprova.');
    }
  }


  goToUserProfile(userId: string) {
    console.log('FLLW: goToUserProfile chiamato per ID:', userId); // Modificato prefisso
    if (userId === this.loggedInUserId) {
      console.log('FLLW: Navigazione a /profilo (profilo proprio).'); // Modificato prefisso
      this.router.navigate(['/profilo']);
    } else {
      console.log('FLLW: Navigazione a /profilo-altri-utenti/', userId); // Modificato prefisso
      this.router.navigate(['/profilo-altri-utenti', userId]);
    }
  }

  async presentFF7Alert(message: string) {
    console.log('FLLW: Presenting FF7 Alert:', message); // Modificato prefisso
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
    console.log('FLLW: ngOnDestroy chiamato. Annullamento sottoscrizioni.'); // Modificato prefisso
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
      console.log('FLLW: usersSubscription annullata.'); // Modificato prefisso
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      console.log('FLLW: authSubscription annullata.'); // Modificato prefisso
    }
  }
}
