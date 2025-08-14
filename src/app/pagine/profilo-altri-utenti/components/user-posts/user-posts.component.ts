// src/app/components/user-posts/user-posts.component.ts

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService } from 'src/app/services/post.service';
import { CommentService } from 'src/app/services/comment.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Post } from 'src/app/interfaces/post';
import { Subscription, from, Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError, take } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { Router, ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, Platform, IonInfiniteScroll, IonicModule, ModalController } from '@ionic/angular';
import { ExpService } from 'src/app/services/exp.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { CommentsModalComponent } from 'src/app/pagine/profilo/components/comments-modal/comments-modal.component';
import { LikeModalComponent } from 'src/app/pagine/profilo/components/like-modal/like-modal.component';


interface PostWithUserDetails extends Post {
  likesUsersMap?: Map<string, UserDashboardCounts>;
  formattedText?: SafeHtml;
  creatorData?: UserDashboardCounts; // ⭐ NOVITÀ: Aggiunto per memorizzare i dati aggiornati del creatore del post
}

@Component({
  selector: 'app-user-posts',
  templateUrl: './user-posts.component.html',
  styleUrls: ['./user-posts.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserPostsComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  @Input() userId!: string;

  posts: PostWithUserDetails[] = [];
  currentUserId: string | null = null;
  isLoadingPosts: boolean = true;
  private postsLimit: number = 10;
  private lastPostTimestamp: string | null = null;
  canLoadMore: boolean = true;

  private authStateUnsubscribe: (() => void) | undefined;
  private postsSubscription: Subscription | undefined;
  private userDataSubscription: Subscription | undefined;
  private usersCache: Map<string, UserDashboardCounts> = new Map();


  constructor(
    private postService: PostService,
    private userDataService: UserDataService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private platform: Platform,
    private expService: ExpService,
    private commentService: CommentService,
    private modalController: ModalController,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    this.authStateUnsubscribe = getAuth().onAuthStateChanged(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.userDataSubscription = from(this.userDataService.getUserDataByUid(this.currentUserId!)).subscribe({
          next: (userData: UserDashboardCounts | null) => {
            if (userData) {
              this.usersCache.set(this.currentUserId!, userData);
            }
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Errore nel recupero dati utente corrente:', err);
            this.cdr.detectChanges();
          }
        });
      } else {
        this.currentUserId = null;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userId'] && changes['userId'].currentValue !== changes['userId'].previousValue) {
      if (this.userId) {
        this.loadInitialPosts();
      } else {
        console.warn('UserPostsComponent: userId non valido, impossibile caricare i post.');
        this.posts = [];
        this.isLoadingPosts = false;
        this.canLoadMore = false;
        if (this.infiniteScroll) {
          this.infiniteScroll.disabled = true;
        }
        this.cdr.detectChanges();
      }
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeAll();
  }

  private unsubscribeAll(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    if (this.postsSubscription) {
      this.postsSubscription.unsubscribe();
    }
    if (this.userDataSubscription) {
      this.userDataSubscription.unsubscribe();
    }
  }

  loadInitialPosts() {
    this.isLoadingPosts = true;
    this.postsSubscription?.unsubscribe();
    this.lastPostTimestamp = null;
    this.canLoadMore = true;

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
      this.infiniteScroll.complete();
    }

    let postsObservable: Observable<Post[]>;
    if (this.userId) {
      postsObservable = this.postService.getUserPosts(this.userId, this.postsLimit, this.lastPostTimestamp);
    } else {
      console.warn('loadInitialPosts: userId non disponibile, impossibile caricare post specifici.');
      this.isLoadingPosts = false;
      this.canLoadMore = false;
      this.posts = [];
      this.cdr.detectChanges();
      return;
    }

    this.postsSubscription = postsObservable.pipe(
      switchMap(postsData => {
        if (!postsData || postsData.length === 0) {
          return of([]);
        }

        const postObservables = postsData.map(post => {
          const likedUserIds = (post.likes || []).slice(0, 3);
          const userPromises = likedUserIds.map(userId => {
            if (this.usersCache.has(userId)) {
              return of(this.usersCache.get(userId)!);
            } else {
              return from(this.userDataService.getUserDataByUid(userId)).pipe(
                map(userData => {
                  if (userData) {
                    this.usersCache.set(userId, userData);
                  }
                  return userData;
                }),
                catchError(err => {
                  console.error(`Errore nel caricamento dati utente ${userId}:`, err);
                  return of(null);
                }),
                take(1)
              );
            }
          });
          // ⭐ NOVITÀ: Richiama anche i dati del creatore del post
          const postCreatorPromise = this.usersCache.has(post.userId) ? of(this.usersCache.get(post.userId)!) : from(this.userDataService.getUserDataByUid(post.userId)).pipe(
            map(userData => {
              if (userData) {
                this.usersCache.set(post.userId, userData);
              }
              return userData;
            }),
            catchError(err => {
              console.error(`Errore nel caricamento dati del creatore del post ${post.userId}:`, err);
              return of(null);
            }),
            take(1)
          );

          return combineLatest(userPromises.length > 0 ? [...userPromises, postCreatorPromise] : [postCreatorPromise]).pipe(
            map(results => {
              const creatorData = results.pop();
              const likedUsersProfiles = results as UserDashboardCounts[];
              const likedUsersMap = new Map<string, UserDashboardCounts>();
              likedUsersProfiles.forEach(profile => {
                if (profile) {
                  likedUsersMap.set(profile.uid, profile);
                }
              });
              return { ...post, likesUsersMap: likedUsersMap, creatorData: creatorData, formattedText: this.formatPostContent(post.text) } as PostWithUserDetails;
            })
          );
        });

        return combineLatest(postObservables);
      })
    ).subscribe({
      next: (postsWithDetails) => {
        this.posts = postsWithDetails;
        this.isLoadingPosts = false;
        if (this.posts.length > 0) {
          this.lastPostTimestamp = this.posts[this.posts.length - 1].timestamp;
        }
        if (postsWithDetails.length < this.postsLimit) {
          this.canLoadMore = false;
          if (this.infiniteScroll) {
            this.infiniteScroll.disabled = true;
          }
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Errore nel caricamento iniziale dei post per utente:', error);
        this.isLoadingPosts = false;
        this.presentAppAlert('Errore di caricamento', 'Impossibile caricare i post di questo utente. Verifica la tua connessione.');
        this.canLoadMore = false;
        if (this.infiniteScroll) {
          this.infiniteScroll.disabled = true;
        }
        this.cdr.detectChanges();
      }
    });
  }


  async loadMorePosts(event: Event) {
    const infiniteScrollTarget = event.target as unknown as IonInfiniteScroll;
    if (!this.canLoadMore || !this.userId) {
      infiniteScrollTarget.complete();
      return;
    }

    try {
      let postsObservable: Observable<Post[]> = this.postService.getUserPosts(this.userId, this.postsLimit, this.lastPostTimestamp);

      this.postsSubscription = postsObservable.pipe(
        switchMap(newPostsData => {
          if (!newPostsData || newPostsData.length === 0) {
            return of([]);
          }

          const newPostObservables = newPostsData.map(post => {
            const likedUserIds = (post.likes || []).slice(0, 3);
            const userPromises = likedUserIds.map(userId => {
              if (this.usersCache.has(userId)) {
                return of(this.usersCache.get(userId)!);
              } else {
                return from(this.userDataService.getUserDataByUid(userId)).pipe(
                  map(userData => {
                    if (userData) {
                      this.usersCache.set(userId, userData);
                    }
                    return userData;
                  }),
                  catchError(err => {
                    console.error(`Errore nel caricamento dati utente ${userId}:`, err);
                    return of(null);
                  }),
                  take(1)
                );
              }
            });
            // ⭐ NOVITÀ: Richiama anche i dati del creatore del post
            const postCreatorPromise = this.usersCache.has(post.userId) ? of(this.usersCache.get(post.userId)!) : from(this.userDataService.getUserDataByUid(post.userId)).pipe(
              map(userData => {
                if (userData) {
                  this.usersCache.set(post.userId, userData);
                }
                return userData;
              }),
              catchError(err => {
                console.error(`Errore nel caricamento dati del creatore del post ${post.userId}:`, err);
                return of(null);
              }),
              take(1)
            );
            return combineLatest(userPromises.length > 0 ? [...userPromises, postCreatorPromise] : [postCreatorPromise]).pipe(
              map(results => {
                const creatorData = results.pop();
                const likedUsersProfiles = results as UserDashboardCounts[];
                const likedUsersMap = new Map<string, UserDashboardCounts>();
                likedUsersProfiles.forEach(profile => {
                  if (profile) {
                    likedUsersMap.set(profile.uid, profile);
                  }
                });
                return { ...post, likesUsersMap: likedUsersMap, creatorData: creatorData, formattedText: this.formatPostContent(post.text) } as PostWithUserDetails;
              })
            );
          });
          return combineLatest(newPostObservables);
        })
      ).subscribe({
        next: (newPostsWithDetails) => {
          this.posts = [...this.posts, ...newPostsWithDetails];
          if (newPostsWithDetails.length > 0) {
            this.lastPostTimestamp = this.posts[this.posts.length - 1].timestamp;
          }

          if (newPostsWithDetails.length < this.postsLimit) {
            this.canLoadMore = false;
            if (this.infiniteScroll) {
              this.infiniteScroll.disabled = true;
            }
          }
          this.cdr.detectChanges();
          infiniteScrollTarget.complete();
        },
        error: (error) => {
          console.error('Errore nel caricamento di altri post:', error);
          this.presentAppAlert('Errore di caricamento', 'Impossibile caricare altri post. Riprova.');
          this.canLoadMore = false;
          if (this.infiniteScroll) {
            this.infiniteScroll.disabled = true;
          }
          this.cdr.detectChanges();
          infiniteScrollTarget.complete();
        }
      });
    } catch (error) {
      console.error('Errore generico in loadMorePosts:', error);
      this.canLoadMore = false;
      if (this.infiniteScroll) {
        this.infiniteScroll.disabled = true;
      }
      infiniteScrollTarget.complete();
    }
  }


  async toggleLike(post: PostWithUserDetails) {
    if (!this.currentUserId) {
      this.presentAppAlert('Accedi Necessario', 'Devi essere loggato per mostrare il tuo apprezzamento!');
      return;
    }

    const hasLiked = (post.likes ?? []).includes(this.currentUserId);
    try {
      await this.postService.toggleLike(post.id, this.currentUserId, !hasLiked);
      if (!hasLiked) {
        post.likes = [...(post.likes ?? []), this.currentUserId];
        if (this.currentUserId && this.usersCache.has(this.currentUserId)) {
          if (!post.likesUsersMap) {
            post.likesUsersMap = new Map();
          }
          post.likesUsersMap.set(this.currentUserId, this.usersCache.get(this.currentUserId)!);
        }
      } else {
        post.likes = (post.likes ?? []).filter(id => id !== this.currentUserId);
        post.likesUsersMap?.delete(this.currentUserId!);
      }
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Errore nel toggle like:', error);
      this.presentAppAlert('Errore', 'Impossibile aggiornare il "Mi piace". Riprova.');
    }
  }

  // ⭐ NUOVO: Metodo per formattare il testo con tag utente e link URL
  formatPostContent(text: string): SafeHtml {
    if (!text) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }

    const tagRegex = /@([a-zA-Z0-9_.-]+)/g;
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    const textWithLinks = text.replace(urlRegex, (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="post-link">${url}</a>`
    );

    const formattedText = textWithLinks.replace(tagRegex, (match, nickname) => {
      return `<a class="user-tag" data-identifier="${nickname}">${match}</a>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(formattedText);
  }

  // ⭐ NUOVO: Metodo per gestire il click sui tag utente
  async onPostTextClick(event: Event) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('user-tag')) {
      event.preventDefault();
      event.stopPropagation();
      const nickname = target.dataset['identifier'];
      if (nickname) {
        try {
          const users = await this.userDataService.searchUsers(nickname);
          const taggedUser = users.find(u => u.nickname.toLowerCase() === nickname.toLowerCase());

          if (taggedUser) {
            this.goToUserProfile(taggedUser.uid);
          } else {
            this.presentAppAlert('Errore di navigazione', `Utente "${nickname}" non trovato.`);
          }
        } catch (error) {
          console.error('Errore durante la ricerca dell\'utente taggato:', error);
          this.presentAppAlert('Errore', 'Impossibile navigare al profilo utente. Riprova.');
        }
      }
    }
  }

  async sharePost(post: Post) {
    const appLink = 'https://alessandropanico.github.io/Sito-Portfolio/';
    const postSpecificLink = `${appLink}#/post/${post.id}`;
    let shareText = `Ho condiviso un post dall'app "NexusPlan"! Vieni a vedere ${postSpecificLink}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post di ${post.username} su NexusPlan`,
          text: shareText,
          url: postSpecificLink,
        });
      } else {
        console.warn('Web Share API non disponibile, copia negli appunti come fallback.');
        await navigator.clipboard.writeText(shareText);
        this.presentAppAlert('Condivisione non supportata', 'La condivisione nativa non è disponibile su questo dispositivo. Il testo del post (con link) è stato copiato negli appunti.');
      }
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Errore durante la condivisione del post:', error);
        this.presentAppAlert('Errore Condivisione', 'Non è stato possibile condividere il post.');
      }
    }
  }

  formatPostTime(timestamp: string): string {
    if (!timestamp) return '';

    try {
      const postDate = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - postDate.getTime();

      const seconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const weeks = Math.floor(days / 7);
      const months = Math.floor(days / 30.44);
      const years = Math.floor(days / 365.25);

      if (seconds < 60) {
        return seconds <= 10 ? 'Adesso' : `${seconds} secondi fa`;
      } else if (minutes < 60) {
        return `${minutes} minuti fa`;
      } else if (hours < 24) {
        return `${hours} ore fa`;
      } else if (days < 7) {
        return `${days} giorni fa`;
      } else if (weeks < 4) {
        return `${weeks} settimane fa`;
      } else if (months < 12) {
        return `${months} mesi fa`;
      } else {
        return `${years} anni fa`;
      }
    } catch (e) {
      console.error("Errore nel formato data (senza date-fns):", timestamp, e);
      return new Date(timestamp).toLocaleDateString('it-IT', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  goToUserProfile(userId: string) {
    if (userId === this.currentUserId) {
      this.router.navigateByUrl('/profilo');
    } else {
      if (userId !== this.userId) {
        this.router.navigateByUrl(`/profilo-altri-utenti/${userId}`);
      }
    }
  }

  async presentAppAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      cssClass: 'app-alert',
      header: header,
      message: message,
      buttons: [
        {
          text: 'OK',
          cssClass: 'app-alert-button',
          role: 'cancel'
        }
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }

  getUserPhoto(photoUrl: string | null | undefined): string {
    const defaultGoogleProfilePicture = 'https://lh3.googleusercontent.com/a/ACg8ocK-pW1q9zsWi1DHCcamHuNOTLOvotU44G2v2qtMUtWu3LI0FOE=s96-c';

    if (!photoUrl || photoUrl === '' || photoUrl === defaultGoogleProfilePicture) {
      return 'assets/immaginiGenerali/default-avatar.jpg';
    }
    return photoUrl;
  }

  async openLikesModal(postId: string) {
    const modal = await this.modalController.create({
      component: LikeModalComponent,
      componentProps: {
        postId: postId,
      },
      cssClass: 'my-custom-likes-modal',
      mode: 'ios',
      breakpoints: [0, 0.25, 0.5, 0.75, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
      animated: true,
    });

    modal.onWillDismiss().then(() => {
      this.loadInitialPosts();
      this.cdr.detectChanges();
    });

    await modal.present();
  }

  getLimitedLikedUsers(likes: string[]): string[] {
    return (likes || []).slice(0, 3);
  }

  getUserAvatarById(userId: string, usersMap?: Map<string, UserDashboardCounts>): string | undefined {
    const userProfile = usersMap?.get(userId) || this.usersCache.get(userId);
    return userProfile ? this.getUserPhoto(userProfile.photo) : undefined;
  }

  getLikedUserName(userId: string, usersMap?: Map<string, UserDashboardCounts>): string {
    const userProfile = usersMap?.get(userId) || this.usersCache.get(userId);
    return userProfile?.nickname || 'Utente sconosciuto';
  }

  // ⭐ NOVITÀ: Metodo per ottenere l'avatar del creatore del post, usando i dati più recenti
  getPostUserPhoto(post: PostWithUserDetails): string {
    if (post.creatorData) {
      return this.getUserPhoto(post.creatorData.photo || post.creatorData.profilePictureUrl);
    }
    // Fallback se i dati del creatore non sono disponibili
    return this.getUserPhoto(post.userAvatarUrl);
  }

  async openCommentsModal(post: Post) {
    const modal = await this.modalController.create({
      component: CommentsModalComponent,
      componentProps: {
        postId: post.id,
        postCreatorAvatar: this.getPostUserPhoto(post as PostWithUserDetails), // ⭐ MODIFICA: Utilizza il nuovo metodo
        postCreatorUsername: post.username,
        postText: post.text
      },
      cssClass: 'my-custom-comments-modal',
      mode: 'ios',
      breakpoints: [0, 0.25, 0.5, 0.75, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
    });

    modal.onWillDismiss().then((data) => {
      this.loadInitialPosts();
      this.cdr.detectChanges();
    });

    await modal.present();
  }
}
