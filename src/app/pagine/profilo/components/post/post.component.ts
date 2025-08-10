import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService } from 'src/app/services/post.service';
import { CommentService } from 'src/app/services/comment.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Post } from 'src/app/interfaces/post';
import { Subscription, from, Observable, combineLatest, of, Subject } from 'rxjs';
import { map, switchMap, catchError, take, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { Router, ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, Platform, IonInfiniteScroll, IonicModule } from '@ionic/angular';
import { ExpService } from 'src/app/services/exp.service';
import { CommentsModalComponent } from '../comments-modal/comments-modal.component';
import { LikeModalComponent } from '../like-modal/like-modal.component';
import { ModalController } from '@ionic/angular';
import { NotificheService } from 'src/app/services/notifiche.service'; // Import del NotificheService

interface PostWithUserDetails extends Post {
  likesUsersMap?: Map<string, UserDashboardCounts>;
}

export interface TagUser {
  uid: string;
  nickname: string;
  fullName?: string;
  photo?: string;
  profilePictureUrl?: string;
}

@Component({
  selector: 'app-post',
  templateUrl: './post.component.html',
  styleUrls: ['./post.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostComponent implements OnInit, OnDestroy {
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  posts: PostWithUserDetails[] = [];
  newPostText: string = '';
  currentUserId: string | null = null;
  currentUserUsername: string = 'Eroe Anonimo';
  currentUserAvatar: string = 'assets/immaginiGenerali/default-avatar.jpg';
  isLoadingPosts: boolean = true;
  private postsLimit: number = 10;
  private lastPostTimestamp: string | null = null;
  canLoadMore: boolean = true;

  showCommentsModal: boolean = false;
  selectedPostIdForComments: string | null = null;
  selectedPostForComments: Post | null = null;
  showLikesModal: boolean = false;
  selectedPostIdForLikes: string | null = null;

  private userIdToDisplayPosts: string | null = null;
  private authStateUnsubscribe: (() => void) | undefined;
  private postsSubscription: Subscription | undefined;
  private userDataSubscription: Subscription | undefined;
  private routeSubscription: Subscription | undefined;
  private usersCache: Map<string, UserDashboardCounts> = new Map();

  // ⭐⭐ NOVITÀ: Variabili per il tagging ⭐⭐
  showTaggingSuggestions: boolean = false;
  taggingUsers: TagUser[] = [];
  private searchUserTerm = new Subject<string>();
  private searchUserSubscription: Subscription | undefined;
  public currentSearchText: string = '';

  constructor(
    private postService: PostService,
    private userDataService: UserDataService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private platform: Platform,
    private expService: ExpService,
    private commentService: CommentService,
    private modalController: ModalController,
    private notificheService: NotificheService

  ) { }

  ngOnInit() {
    this.authStateUnsubscribe = getAuth().onAuthStateChanged(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.userDataSubscription = from(this.userDataService.getUserDataByUid(this.currentUserId!)).subscribe({
          next: (userData: UserDashboardCounts | null) => {
            if (userData) {
              this.currentUserUsername = userData.nickname || 'Eroe Anonimo';
              this.currentUserAvatar = this.getUserPhoto(userData.photo || userData.profilePictureUrl);
              this.usersCache.set(this.currentUserId!, userData);
            }
            this.cdr.detectChanges();

            this.routeSubscription = this.activatedRoute.paramMap.subscribe(params => {
              const profileUserId = params.get('userId');

              if (profileUserId && profileUserId !== this.currentUserId) {
                this.userIdToDisplayPosts = profileUserId;
              } else {
                this.userIdToDisplayPosts = this.currentUserId;
              }
              this.loadInitialPosts();
            });
          },
          error: (err) => {
            console.error('Errore nel recupero dati utente:', err);
            this.presentAppAlert('Errore Utente', 'Impossibile caricare i dati del tuo profilo.');
            this.isLoadingPosts = false;
            this.cdr.detectChanges();
          }
        });
      } else {
        this.currentUserId = null;
        this.posts = [];
        this.isLoadingPosts = false;
        this.cdr.detectChanges();
        this.unsubscribeAll();
      }
    });

    this.searchUserSubscription = this.searchUserTerm.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      if (searchTerm) {
        this.searchUsersForTagging(searchTerm);
      } else {
        this.taggingUsers = [];
        this.cdr.detectChanges();
      }
    });
  }


  ngOnDestroy(): void {
    this.unsubscribeAll();
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    if (this.searchUserSubscription) {
      this.searchUserSubscription.unsubscribe();
    }
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

    this.showCommentsModal = false;
    this.selectedPostIdForComments = null;
    this.selectedPostForComments = null;
    this.showLikesModal = false;
    this.selectedPostIdForLikes = null;

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
      this.infiniteScroll.complete();
    }

    let postsObservable: Observable<Post[]>;
    if (this.userIdToDisplayPosts) {
      postsObservable = this.postService.getUserPosts(this.userIdToDisplayPosts, this.postsLimit, this.lastPostTimestamp);
    } else {
      postsObservable = this.postService.getPosts(this.postsLimit, this.lastPostTimestamp);
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

          return combineLatest(userPromises.length > 0 ? userPromises : [of(null)]).pipe(
            map(likedUsersProfiles => {
              const likedUsersMap = new Map<string, UserDashboardCounts>();
              likedUsersProfiles.forEach(profile => {
                if (profile) {
                  likedUsersMap.set(profile.uid, profile);
                }
              });
              return { ...post, likesUsersMap: likedUsersMap } as PostWithUserDetails;
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
        console.error('Errore nel caricamento iniziale dei post:', error);
        this.isLoadingPosts = false;
        this.presentAppAlert('Errore di caricamento', 'Impossibile caricare i post. Verifica la tua connessione.');
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
    if (!this.canLoadMore) {
      infiniteScrollTarget.complete();
      return;
    }

    try {
      let postsObservable: Observable<Post[]>;
      if (this.userIdToDisplayPosts) {
        postsObservable = this.postService.getUserPosts(this.userIdToDisplayPosts, this.postsLimit, this.lastPostTimestamp);
      } else {
        postsObservable = this.postService.getPosts(this.postsLimit, this.lastPostTimestamp);
      }

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
            return combineLatest(userPromises.length > 0 ? userPromises : [of(null)]).pipe(
              map(likedUsersProfiles => {
                const likedUsersMap = new Map<string, UserDashboardCounts>();
                likedUsersProfiles.forEach(profile => {
                  if (profile) {
                    likedUsersMap.set(profile.uid, profile);
                  }
                });
                return { ...post, likesUsersMap: likedUsersMap } as PostWithUserDetails;
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


  async createPost() {
    if (!this.newPostText.trim() || !this.currentUserId) {
      this.presentAppAlert('Attenzione', 'Il testo del post non può essere vuoto e devi essere autenticato.');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Pubblicazione in corso...',
      spinner: 'crescent'
    });
    await loading.present();

    const newPost: Omit<Post, 'id' | 'likes' | 'commentsCount'> = {
      userId: this.currentUserId,
      username: this.currentUserUsername,
      userAvatarUrl: this.currentUserAvatar,
      text: this.newPostText.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      // ⭐⭐ NOVITÀ: Creazione del post e ottenimento dell'ID ⭐⭐
      const postId = await this.postService.createPost(newPost);
      this.newPostText = '';
      const textarea = document.querySelector('.app-textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
      }
      this.presentAppAlert('Successo', 'Il tuo messaggio è stato pubblicato con successo nell\'etere!');
      this.expService.addExperience(50, 'postCreated');

      // ⭐⭐ NOVITÀ: Chiamata al metodo per processare i tag e inviare le notifiche
      await this.processTagsAndNotify(newPost.text, postId);

      this.loadInitialPosts();
    } catch (error) {
      console.error('Errore nella creazione del post:', error);
      this.presentAppAlert('Errore di pubblicazione', 'Impossibile pubblicare il post. Riprova più tardi.');
    } finally {
      await loading.dismiss();
    }
  }

  private async processTagsAndNotify(postText: string, postId: string) {
    if (!this.currentUserId || !this.currentUserUsername) {
      console.error('Impossibile inviare notifiche di menzione: utente non autenticato.');
      return;
    }

    // Regex per trovare tutti i tag "@nomeutente"
    const tagRegex = /@(\w+)/g;
    let match;
    const mentionedUsernames = new Set<string>();

    while ((match = tagRegex.exec(postText)) !== null) {
      mentionedUsernames.add(match[1]);
    }

    for (const username of Array.from(mentionedUsernames)) {
      try {
        // Cerca l'utente per nickname
        const users = await this.userDataService.searchUsers(username);
        const taggedUser = users.find(u => u.nickname.toLowerCase() === username.toLowerCase());

        // Se l'utente esiste e non è l'utente che ha creato il post
        if (taggedUser && taggedUser.uid !== this.currentUserId) {
          await this.notificheService.aggiungiNotificaMenzionePost(
            taggedUser.uid,
            this.currentUserUsername,
            postId
          );
        }
      } catch (error) {
        console.error(`Errore durante la notifica di menzione per l'utente ${username}:`, error);
      }
    }
  }

  async presentDeleteAlert(postId: string) {
    const alert = await this.alertCtrl.create({
      cssClass: 'app-alert',
      header: 'Conferma Eliminazione',
      message: 'Sei sicuro di voler eliminare questo post? Questa azione è irreversibile!',
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel',
          cssClass: 'app-alert-button cancel-button',
        },
        {
          text: 'Elimina',
          cssClass: 'app-alert-button delete-button',
          handler: async () => {
            await this.deletePost(postId);
          }
        }
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }

  async deletePost(postId: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Eliminazione in corso...',
      spinner: 'crescent'
    });
    await loading.present();
    try {
      await this.commentService.deleteAllCommentsForPost(postId);
      await this.postService.deletePost(postId);
      this.presentAppAlert('Post Eliminato', 'Il post è stato rimosso con successo.');
      this.loadInitialPosts();
    } catch (error) {
      console.error('Errore nell\'eliminazione del post:', error);
      this.presentAppAlert('Errore di eliminazione', 'Non è stato possibile eliminare il post. Sei il vero proprietario?');
    } finally {
      await loading.dismiss();
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

  toggleCommentsVisibility(post: Post) {
    this.selectedPostIdForComments = post.id;
    this.selectedPostForComments = post;
    this.showCommentsModal = true;
    this.cdr.detectChanges();
  }

  closeCommentsModal(): void {
    this.showCommentsModal = false;
    this.selectedPostIdForComments = null;
    this.selectedPostForComments = null;
    this.cdr.detectChanges();
    this.loadInitialPosts();
  }

  formatTextWithLinks(text: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="post-link">${url}</a>`);
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
        this.expService.addExperience(20, 'postShared');
      } else {
        console.warn('Web Share API non disponibile, copia negli appunti come fallback.');
        await navigator.clipboard.writeText(shareText);
        this.presentAppAlert('Condivisione non supportata', 'La condivisione nativa non è disponibile su questo dispositivo. Il testo del post (con link) è stato copiato negli appunti.');
      }
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Errore durante la condivisione del post:', error);
        this.presentAppAlert('Errore Condivisione', 'Non è stato possibile condividere il post.');
      } else {
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

  selectImage() {
    this.presentAppAlert('Funzionalità Futura', 'L\'aggiunta di immagini sarà disponibile in un prossimo aggiornamento! Preparati a condividere i tuoi scatti migliori.');
  }

  goToUserProfile(userId: string) {
    if (userId === this.currentUserId) {
      this.router.navigateByUrl('/profilo');
    } else {
      this.router.navigateByUrl(`/profilo/${userId}`);
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

  // ⭐⭐ NOVITÀ: Metodo modificato per gestire il tagging ⭐⭐
  adjustTextareaHeight(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;

    textarea.style.height = 'auto';

    const maxHeightCss = window.getComputedStyle(textarea).maxHeight;
    const maxHeightPx = parseFloat(maxHeightCss);

    if (textarea.scrollHeight > maxHeightPx) {
      textarea.style.height = maxHeightPx + 'px';
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = textarea.scrollHeight + 'px';
      textarea.style.overflowY = 'hidden';
    }

    const text = this.newPostText;
    const atIndex = text.lastIndexOf('@');

    if (atIndex !== -1) {
      const textAfterAt = text.substring(atIndex + 1);
      const spaceIndex = textAfterAt.indexOf(' ');

      if (spaceIndex !== -1) {
        this.showTaggingSuggestions = false;
        this.taggingUsers = [];
        this.currentSearchText = '';
      } else {
        this.showTaggingSuggestions = true;
        this.currentSearchText = textAfterAt;
        this.searchUserTerm.next(this.currentSearchText);
      }
    } else {
      this.showTaggingSuggestions = false;
      this.taggingUsers = [];
      this.currentSearchText = '';
    }
    this.cdr.detectChanges();
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

  // Modifica questa funzione per aprire il modale dei likes con ModalController
  async openLikesModal(postId: string) {
    const modal = await this.modalController.create({
      component: LikeModalComponent, // Specifica il componente LikeModalComponent
      componentProps: {
        postId: postId,
      },
      cssClass: 'my-custom-likes-modal', // Puoi definire una classe CSS personalizzata per il modale dei likes
      mode: 'ios',
      breakpoints: [0, 0.25, 0.5, 0.75, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
    });

    modal.onWillDismiss().then(() => {
      // Quando il modale viene chiuso, ricarica i post per aggiornare i conteggi/stati dei like
      this.loadInitialPosts();
      this.cdr.detectChanges();
    });

    await modal.present();
  }

  closeLikesModal(): void {
    this.showLikesModal = false;
    this.selectedPostIdForLikes = null;
    this.cdr.detectChanges();
  }

  /**
   * Restituisce un array limitato di ID utente che hanno messo like.
   * Utilizzato per mostrare solo un subset di avatar nella preview.
   * @param likes L'array di ID utente che hanno messo like al post.
   * @returns Un array contenente al massimo i primi 3 ID utente.
   */
  getLimitedLikedUsers(likes: string[]): string[] {
    return (likes || []).slice(0, 3);
  }

  /**
   * Recupera l'URL dell'avatar di un utente dato il suo ID, usando la mappa cache del post.
   * @param userId L'ID dell'utente.
   * @param usersMap La mappa specifica degli utenti che hanno messo like per questo post.
   * @returns L'URL dell'avatar dell'utente, o undefined se non trovato.
   */
  getUserAvatarById(userId: string, usersMap?: Map<string, UserDashboardCounts>): string | undefined {
    // Prima cerca nella mappa specifica del post, poi nella cache globale
    const userProfile = usersMap?.get(userId) || this.usersCache.get(userId);
    return userProfile ? this.getUserPhoto(userProfile.profilePictureUrl || userProfile.photo) : undefined;
  }

  /**
   * Recupera il nickname di un utente dato il suo ID, usando la mappa cache del post.
   * @param userId L'ID dell'utente.
   * @param usersMap La mappa specifica degli utenti che hanno messo like per questo post.
   * @returns Il nickname dell'utente, o 'Utente sconosciuto' come fallback.
   */
  getLikedUserName(userId: string, usersMap?: Map<string, UserDashboardCounts>): string {
    const userProfile = usersMap?.get(userId) || this.usersCache.get(userId);
    return userProfile?.nickname || 'Utente sconosciuto';
  }

  async openCommentsModal(post: Post) {
    const modal = await this.modalController.create({
      component: CommentsModalComponent,
      componentProps: {
        postId: post.id,
        postCreatorAvatar: post.userAvatarUrl,
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

  // ⭐⭐ NOVITÀ: Metodi per la gestione del tagging ⭐⭐
  async searchUsersForTagging(searchTerm: string) {
    if (!searchTerm || searchTerm.length < 2) {
      this.taggingUsers = [];
      this.cdr.detectChanges();
      return;
    }

    try {
      const users = await this.userDataService.searchUsers(searchTerm);
      this.taggingUsers = users;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Errore durante la ricerca utenti per tagging:', error);
      this.taggingUsers = [];
      this.presentAppAlert('Errore di ricerca', 'Impossibile cercare utenti.');
      this.cdr.detectChanges();
    }
  }

  selectUserForTagging(user: TagUser) {
    const text = this.newPostText;
    const atIndex = text.lastIndexOf('@');

    if (atIndex !== -1) {
      const prefix = text.substring(0, atIndex);
      this.newPostText = `${prefix}@${user.nickname} `;
    } else {
      this.newPostText = `@${user.nickname} `;
    }

    this.showTaggingSuggestions = false;
    this.taggingUsers = [];
    this.currentSearchText = '';

    this.cdr.detectChanges();
    const textarea = document.querySelector('.app-textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(this.newPostText.length, this.newPostText.length);
    }
  }
}
