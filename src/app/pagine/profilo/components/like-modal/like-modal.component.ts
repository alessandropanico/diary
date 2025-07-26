import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { Subscription, from, combineLatest, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { Router } from '@angular/router'; // Importa il Router

import { PostService } from 'src/app/services/post.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { FollowService } from 'src/app/services/follow.service';
import { Post } from 'src/app/interfaces/post';

@Component({
  selector: 'app-like-modal',
  templateUrl: './like-modal.component.html',
  styleUrls: ['./like-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LikeModalComponent implements OnInit, OnDestroy {
  @Input() postId!: string;
  @Output() closeModalEvent = new EventEmitter<void>();

  likedUsers: { profile: UserDashboardCounts & { uid: string }, isFollowing: boolean }[] = [];
  isLoading: boolean = true;
  currentUserId: string | null = null; // Già presente
  loggedInUserId: string | null = null; // <-- NUOVA PROPRIETÀ
  private subscriptions: Subscription = new Subscription();

  constructor(
    private postService: PostService,
    private userDataService: UserDataService,
    private followService: FollowService,
    private cdr: ChangeDetectorRef,
    private modalController: ModalController,
    private router: Router
  ) { }

  ngOnInit() {
    this.currentUserId = getAuth().currentUser?.uid || null;
    this.loggedInUserId = this.currentUserId; // Inizializza l'ID utente loggato

    if (this.postId) {
      this.subscriptions.add(
        this.postService.getPostById(this.postId).pipe(
          switchMap((post: Post | null) => {
            if (post && post.likes && post.likes.length > 0) {
              const userObservables = post.likes.map((userId: string) =>
                from(this.userDataService.getUserDataByUid(userId)).pipe(
                  switchMap(userProfile => {
                    if (userProfile && this.currentUserId) {
                      return this.followService.isFollowing(this.currentUserId, userId).pipe(
                        map(isFollowing => ({
                          profile: {
                            ...userProfile,
                            uid: userId,
                            nickname: userProfile.nickname ?? 'N/D'
                          },
                          isFollowing: isFollowing
                        })),
                        catchError(err => {
                          console.error(`Errore nel controllo follow per ${userId}:`, err);
                          return of({
                            profile: {
                              ...userProfile,
                              uid: userId,
                              nickname: userProfile.nickname ?? 'N/D'
                            },
                            isFollowing: false
                          });
                        })
                      );
                    } else if (userProfile) {
                        return of({
                           profile: {
                             ...userProfile,
                             uid: userId,
                             nickname: userProfile.nickname ?? 'N/D'
                           },
                           isFollowing: false
                         });
                    }
                    return of(null);
                  })
                )
              );
              return combineLatest(userObservables).pipe(
                map(users => users.filter(u => u !== null) as { profile: UserDashboardCounts & { uid: string }, isFollowing: boolean }[])
              );
            } else {
              return of([]);
            }
          })
        )
        .subscribe({
          next: (usersWithFollowStatus) => {
            this.likedUsers = usersWithFollowStatus
              .sort((a, b) => {
                const nicknameA = a.profile.nickname || '';
                const nicknameB = b.profile.nickname || '';

                if (this.currentUserId && a.profile.uid === this.currentUserId) return -1;
                if (this.currentUserId && b.profile.uid === this.currentUserId) return 1;
                return nicknameA.localeCompare(nicknameB);
              });
            this.isLoading = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Errore nel caricamento degli utenti che hanno messo like:', err);
            this.isLoading = false;
            this.likedUsers = [];
            this.cdr.detectChanges();
          }
        })
      );
    } else {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  closeModal() {
    this.closeModalEvent.emit();
  }

  async toggleFollow(userToFollow: { profile: UserDashboardCounts & { uid: string }, isFollowing: boolean }) {
    if (!this.currentUserId) {
      console.warn('Devi essere loggato per seguire un utente.');
      // TODO: Mostra un Toast o un Alert all'utente
      return;
    }
    if (this.currentUserId === userToFollow.profile.uid) {
      console.warn('Non puoi seguire te stesso.');
      return;
    }

    try {
      if (userToFollow.isFollowing) {
        await this.followService.unfollowUser(this.currentUserId, userToFollow.profile.uid);
      } else {
        await this.followService.followUser(this.currentUserId, userToFollow.profile.uid);
      }
      userToFollow.isFollowing = !userToFollow.isFollowing;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Errore nell\'operazione di follow/unfollow:', error);
      // TODO: Mostra un Toast o un Alert all'utente
    }
  }

  // ⭐⭐⭐ METODO goToUserProfile AGGIORNATO ⭐⭐⭐
  goToUserProfile(userId: string) {
    this.closeModal(); // Chiudi il modale

    if (userId === this.loggedInUserId) {
      this.router.navigate(['/profilo']); // Naviga alla rotta del proprio profilo
    } else {
      this.router.navigate(['/profilo-altri-utenti', userId]); // Naviga alla rotta per gli altri profili con l'ID
    }
  }

  getUserPhoto(photoUrl: string | null | undefined): string {
    const defaultGoogleProfilePicture = 'https://lh3.googleusercontent.com/a/ACg8ocK-pW1q9zsWi1DHCcamHuNOTLOvotU44G2v2qtMUtWu3LI0FOE=s96-c';

    if (!photoUrl || photoUrl === '' || photoUrl === defaultGoogleProfilePicture) {
      return 'assets/immaginiGenerali/default-avatar.jpg';
    }
    return photoUrl;
  }
}
