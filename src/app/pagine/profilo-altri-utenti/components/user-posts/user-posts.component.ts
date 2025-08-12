// src/app/components/user-posts/user-posts.component.ts

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Mantenuto per compatibilità ma non usato per textarea
import { PostService } from 'src/app/services/post.service';
import { CommentService } from 'src/app/services/comment.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Post } from 'src/app/interfaces/post';
import { Subscription, from, Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError, take } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { Router, ActivatedRoute } from '@angular/router'; // ActivatedRoute non strettamente necessario se usi solo @Input
import { AlertController, LoadingController, Platform, IonInfiniteScroll, IonicModule, ModalController } from '@ionic/angular';
import { ExpService } from 'src/app/services/exp.service';

import { CommentsModalComponent } from 'src/app/pagine/profilo/components/comments-modal/comments-modal.component';
import { LikeModalComponent } from 'src/app/pagine/profilo/components/like-modal/like-modal.component';



interface PostWithUserDetails extends Post {
  likesUsersMap?: Map<string, UserDashboardCounts>;
}

@Component({
  selector: 'app-user-posts', // Nome del selettore
  templateUrl: './user-posts.component.html',
  styleUrls: ['./user-posts.component.scss'], // Userà lo stesso SCSS di post.component
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

  // ⭐ INPUT PROPERTY per l'ID dell'utente da cui caricare i post ⭐
  @Input() userId!: string;

  posts: PostWithUserDetails[] = [];
  // newPostText: string = ''; // Rimosso: non si creano post qui
  currentUserId: string | null = null; // ID dell'utente attualmente loggato (tu)
  // currentUserUsername: string = 'Eroe Anonimo'; // Non serve per visualizzare i post di altri
  // currentUserAvatar: string = 'assets/immaginiGenerali/default-avatar.jpg'; // Non serve per visualizzare i post di altri
  isLoadingPosts: boolean = true;
  private postsLimit: number = 10;
  private lastPostTimestamp: string | null = null;
  canLoadMore: boolean = true;

  // Modali non necessarie come proprietà del componente, gestite direttamente dal ModalController
  // showCommentsModal: boolean = false;
  // selectedPostIdForComments: string | null = null;
  // selectedPostForComments: Post | null = null;
  // showLikesModal: boolean = false;
  // selectedPostIdForLikes: string | null = null;

  // private userIdToDisplayPosts: string | null = null; // Rimosso: usa this.userId dall'Input
  private authStateUnsubscribe: (() => void) | undefined;
  private postsSubscription: Subscription | undefined;
  private userDataSubscription: Subscription | undefined; // Mantenuta per recuperare i dati del currentUser
  // private routeSubscription: Subscription | undefined; // Rimosso: userId viene da Input
  private usersCache: Map<string, UserDashboardCounts> = new Map();


  constructor(
    private postService: PostService,
    private userDataService: UserDataService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    // private activatedRoute: ActivatedRoute, // Non più necessario se l'ID viene da @Input
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private platform: Platform, // Mantenuto per compatibilità se hai logica specifica della piattaforma
    private expService: ExpService, // Mantenuto per compatibilità, ma non userà addExperience direttamente qui
    private commentService: CommentService,
    private modalController: ModalController
  ) { }

  ngOnInit() {
    this.authStateUnsubscribe = getAuth().onAuthStateChanged(user => {
      if (user) {
        this.currentUserId = user.uid;
        // Carica i dati dell'utente loggato per il getUserPhoto, ecc.
        this.userDataSubscription = from(this.userDataService.getUserDataByUid(this.currentUserId!)).subscribe({
          next: (userData: UserDashboardCounts | null) => {
            if (userData) {
              // this.currentUserUsername = userData.nickname || 'Eroe Anonimo'; // Non più necessario
              // this.currentUserAvatar = this.getUserPhoto(userData.photo || userData.profilePictureUrl); // Non più necessario
              this.usersCache.set(this.currentUserId!, userData);
            }
            this.cdr.detectChanges(); // Per assicurare che la UI si aggiorni se dipendente da current user
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
      // Il caricamento iniziale dei post viene gestito in ngOnChanges, quando l'Input userId è disponibile
    });
  }

  // ⭐ Implementazione di OnChanges per reagire ai cambiamenti dell'Input userId ⭐
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
    // this.routeSubscription non esiste più
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

    // reset di modali non più gestite come proprietà locali
    // this.showCommentsModal = false;
    // this.selectedPostIdForComments = null;
    // this.selectedPostForComments = null;
    // this.showLikesModal = false;
    // this.selectedPostIdForLikes = null;

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
      this.infiniteScroll.complete();
    }

    // ⭐ Usa this.userId direttamente dall'Input ⭐
    let postsObservable: Observable<Post[]>;
    if (this.userId) { // Deve esserci un userId valido per caricare i post di un utente specifico
      postsObservable = this.postService.getUserPosts(this.userId, this.postsLimit, this.lastPostTimestamp);
    } else {
      // Questo caso non dovrebbe accadere se userId è sempre passato
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
    if (!this.canLoadMore || !this.userId) { // Aggiunto controllo userId
      infiniteScrollTarget.complete();
      return;
    }

    try {
      // ⭐ Usa this.userId direttamente dall'Input ⭐
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

  // ⭐ createPost Rimosso: non si creano post qui ⭐
  // async createPost() { /* ... */ }

  // ⭐ presentDeleteAlert Rimosso: non si eliminano post di altri utenti qui ⭐
  // async presentDeleteAlert(postId: string) { /* ... */ }

  // ⭐ deletePost Rimosso: non si eliminano post di altri utenti qui ⭐
  // async deletePost(postId: string) { /* ... */ }

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

  // toggleCommentsVisibility(post: Post) { // Rimosso: usa direttamente openCommentsModal
  //   this.selectedPostIdForComments = post.id;
  //   this.selectedPostForComments = post;
  //   this.showCommentsModal = true;
  //   this.cdr.detectChanges();
  // }

  // closeCommentsModal(): void { // Rimosso: callback del ModalController
  //   this.showCommentsModal = false;
  //   this.selectedPostIdForComments = null;
  //   this.selectedPostForComments = null;
  //   this.cdr.detectChanges();
  //   this.loadInitialPosts();
  // }

  formatTextWithLinks(text: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="post-link">${url}</a>`);
  }

  async sharePost(post: Post) {
    const appLink = 'https://alessandropanico.github.io/Sito-Portfolio/'; // Il tuo link
    const postSpecificLink = `${appLink}#/post/${post.id}`;
    let shareText = `Ho condiviso un post dall'app "NexusPlan"! Vieni a vedere ${postSpecificLink}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post di ${post.username} su NexusPlan`,
          text: shareText,
          url: postSpecificLink,
        });
        // Non aggiungere XP qui, perché è per un utente terzo
        // this.expService.addExperience(20, 'postShared');
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

  // selectImage() { // Rimosso: non si creano post qui
  //   this.presentAppAlert('Funzionalità Futura', 'L\'aggiunta di immagini sarà disponibile in un prossimo aggiornamento! Preparati a condividere i tuoi scatti migliori.');
  // }

  goToUserProfile(userId: string) {
    if (userId === this.currentUserId) {
      this.router.navigateByUrl('/profilo');
    } else {
      // Già siamo sulla pagina di un altro utente, possiamo fare un re-route se l'ID è diverso
      // o semplicemente ignorare se è lo stesso ID per evitare refresh inutili
      if (userId !== this.userId) { // Se clicca su un utente diverso da quello del profilo visualizzato
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

  // adjustTextareaHeight(event: Event) { /* ... */ } // Rimosso: non si crea post qui

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

  // closeLikesModal(): void { // Rimosso: callback del ModalController
  //   this.showLikesModal = false;
  //   this.selectedPostIdForLikes = null;
  //   this.cdr.detectChanges();
  // }

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
}
