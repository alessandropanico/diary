// src/app/components/comment-likes-modal/comment-likes-modal.component.ts

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { Subscription, from, combineLatest, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { Router } from '@angular/router';

import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { FollowService } from 'src/app/services/follow.service';
import { Comment } from 'src/app/interfaces/comment'; // Assicurati che il percorso sia corretto
import { CommentService } from 'src/app/services/comment.service'; // Avrai bisogno anche del CommentService

@Component({
  selector: 'app-comment-likes-modal',
  templateUrl: './comment-likes-modal.component.html',
  styleUrls: ['./comment-likes-modal.component.scss'], // Puoi riutilizzare gli stili del LikeModalComponent se ne hai uno
  standalone: true,
  imports: [CommonModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentLikesModalComponent implements OnInit, OnDestroy {
  @Input() postId!: string; // ID del post a cui appartiene il commento
  @Input() commentId!: string; // ID del commento o risposta di cui mostrare i likes
  @Output() closeModalEvent = new EventEmitter<void>();

  likedUsers: { profile: UserDashboardCounts & { uid: string }, isFollowing: boolean }[] = [];
  isLoading: boolean = true;
  currentUserId: string | null = null;
  loggedInUserId: string | null = null;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private userDataService: UserDataService,
    private followService: FollowService,
    private commentService: CommentService, // Inietta il CommentService
    private cdr: ChangeDetectorRef,
    private modalController: ModalController,
    private router: Router
  ) { }

  ngOnInit() {
    this.currentUserId = getAuth().currentUser?.uid || null;
    this.loggedInUserId = this.currentUserId;

    if (this.postId && this.commentId) {
      this.subscriptions.add(
        from(this.commentService.getCommentByIdOnce(this.postId, this.commentId)).pipe(
          switchMap((comment: Comment | null) => {
            if (comment && comment.likes && comment.likes.length > 0) {
              const userObservables = comment.likes.map((userId: string) =>
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
            console.error('Errore nel caricamento degli utenti che hanno messo like al commento:', err);
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
    this.modalController.dismiss(); // Chiude questo modale (CommentLikesModalComponent)
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

  goToUserProfile(userId: string) {
    this.modalController.dismiss(); // Chiudi il modale dei likes
    if (userId === this.loggedInUserId) {
      this.router.navigate(['/profilo']);
    } else {
      this.router.navigate(['/profilo-altri-utenti', userId]);
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
