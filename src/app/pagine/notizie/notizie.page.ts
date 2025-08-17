import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService } from 'src/app/services/post.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Post } from 'src/app/interfaces/post';
import { Subscription, from, Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError, take, tap } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { Router } from '@angular/router';
import { AlertController, LoadingController, IonInfiniteScroll } from '@ionic/angular';
import { ExpService } from 'src/app/services/exp.service';
import { ModalController } from '@ionic/angular';
import { CommentsModalComponent } from '../profilo/components/comments-modal/comments-modal.component';
import { LikeModalComponent } from '../profilo/components/like-modal/like-modal.component';
import { FollowService } from 'src/app/services/follow.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'; // ⭐ NUOVO: Importa DomSanitizer e SafeHtml

import { ChatService } from 'src/app/services/chat.service'; // ⭐ AGGIUNGI QUESTO IMPORT ⭐
import { SearchModalComponent } from 'src/app/shared/search-modal/search-modal.component';

// ⭐ NUOVO: Interfaccia per la gestione dei tag
export interface TagUser {
  uid: string;
  nickname: string;
  fullName?: string;
  photo?: string;
  profilePictureUrl?: string;
}

// Interfaccia estesa per i post con dettagli utente
interface PostWithUserDetails extends Post {
  likesUsersMap?: Map<string, UserDashboardCounts>;
  username: string;
  userPhoto: string;
  formattedText?: SafeHtml; // ⭐ MODIFICA: Il testo formattato è ora SafeHtml
}

@Component({
  selector: 'app-notizie-page',
  templateUrl: './notizie.page.html',
  styleUrls: ['./notizie.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotiziePage implements OnInit, OnDestroy {
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  posts: PostWithUserDetails[] = [];
  currentUserId: string | null = null;
  currentUserUsername: string = 'Eroe Anonimo';
  currentUserAvatar: string = 'assets/immaginiGenerali/default-avatar.jpg';
  isLoadingPosts: boolean = true;
  private postsLimit: number = 10;
  private lastPostTimestamp: string | null = null;
  canLoadMore: boolean = true;
  private followingUserIds: string[] = [];
  private feedUserIds: string[] = [];

  private usersCache: Map<string, UserDashboardCounts> = new Map();
  private authStateUnsubscribe: (() => void) | undefined;
  private postsSubscription: Subscription | undefined;
  private userDataSubscription: Subscription | undefined;

  constructor(
    private postService: PostService,
    private userDataService: UserDataService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private expService: ExpService,
    private modalController: ModalController,
    private followService: FollowService,
    private sanitizer: DomSanitizer,
    private chatService: ChatService,
  ) { }

  ngOnInit() {
    this.authStateUnsubscribe = getAuth().onAuthStateChanged(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.loadCurrentUserProfileAndFollowing();
      } else {
        this.currentUserId = null;
        this.posts = [];
        this.isLoadingPosts = false;
        this.cdr.detectChanges();
        this.unsubscribeAll();
      }
    });
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

  private async loadCurrentUserProfileAndFollowing() {
    if (!this.currentUserId) {
      this.isLoadingPosts = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      const userData = await this.userDataService.getUserDataByUid(this.currentUserId);
      if (userData) {
        this.currentUserUsername = userData.nickname || 'Eroe Anonimo';
        this.currentUserAvatar = this.getUserPhoto(userData.photo || userData.profilePictureUrl);
        this.usersCache.set(this.currentUserId, userData);
      }

      this.followService.getFollowingIds(this.currentUserId).subscribe(followingIds => {
        this.followingUserIds = followingIds;
        this.feedUserIds = [...this.followingUserIds, this.currentUserId!];
        this.loadInitialPosts();
        this.cdr.detectChanges();
      });

    } catch (error) {
      console.error('Errore nel recupero dati utente o utenti seguiti:', error);
      this.presentAppAlert('Errore Utente', 'Impossibile caricare i dati del tuo profilo.');
      this.isLoadingPosts = false;
      this.cdr.detectChanges();
    }
  }

  private loadInitialPosts() {
    if (this.feedUserIds.length === 0) {
      console.warn('PostService: Tentativo di caricare post con lista di ID utenti vuota.');
      this.isLoadingPosts = false;
      this.cdr.detectChanges();
      return;
    }

    this.postsSubscription = this.postService.getFollowingUsersPosts(this.feedUserIds, this.postsLimit, this.lastPostTimestamp).pipe(
      switchMap(postsData => this.addUserDetailsToPosts(postsData))
    ).subscribe({
      next: (postsWithDetails) => {
        this.posts = postsWithDetails;
        this.isLoadingPosts = false;
        this.updateInfiniteScroll(postsWithDetails);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('PostService: Errore nel recupero dei post:', err);
        this.isLoadingPosts = false;
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
      this.postsSubscription = this.postService.getFollowingUsersPosts(this.feedUserIds, this.postsLimit, this.lastPostTimestamp).pipe(
        switchMap(newPostsData => this.addUserDetailsToPosts(newPostsData))
      ).subscribe({
        next: (newPostsWithDetails) => {
          this.posts = [...this.posts, ...newPostsWithDetails];
          this.updateInfiniteScroll(newPostsWithDetails);
          this.cdr.detectChanges();
          infiniteScrollTarget.complete();
        },
        error: (error) => {
          console.error('Errore nel caricamento di altri post:', error);
          this.handleError('Errore di caricamento', 'Impossibile caricare altri post. Riprova.', infiniteScrollTarget);
        }
      });
    } catch (error) {
      console.error('Errore generico in loadMorePosts:', error);
      this.handleError('Errore generico', 'Si è verificato un errore inaspettato.', infiniteScrollTarget);
    }
  }

  private addUserDetailsToPosts(postsData: Post[]): Observable<PostWithUserDetails[]> {
    if (!postsData || postsData.length === 0) {
      return of([]);
    }

    const postObservables = postsData.map(post => {
      const postUserObservable = this.getUserData(post.userId);
      const likedUserIds = (post.likes || []).slice(0, 3);
      const likedUsersObservables = likedUserIds.map(userId => this.getUserData(userId));

      return combineLatest([postUserObservable, ...likedUsersObservables]).pipe(
        map(([postUserProfile, ...likedUsersProfiles]) => {
          const likedUsersMap = new Map<string, UserDashboardCounts>();
          likedUsersProfiles.forEach(profile => {
            if (profile) {
              likedUsersMap.set(profile.uid, profile);
            }
          });

          return {
            ...post,
            username: postUserProfile?.nickname || 'Utente Sconosciuto',
            userPhoto: this.getUserPhoto(postUserProfile?.photo),
            likesUsersMap: likedUsersMap,
            formattedText: this.formatPostContent(post.text as string), // ⭐ MODIFICA: Chiama il metodo per formattare il testo
          } as PostWithUserDetails;
        })
      );
    });

    return combineLatest(postObservables);
  }

  private getUserData(userId: string): Observable<UserDashboardCounts | null> {
    if (this.usersCache.has(userId)) {
      return of(this.usersCache.get(userId)!);
    } else {
      return from(this.userDataService.getUserDataByUid(userId)).pipe(
        tap(userData => {
          if (userData) {
            this.usersCache.set(userId, userData);
          }
        }),
        catchError(() => of(null)),
        take(1)
      );
    }
  }

  // ⭐ NUOVO: Metodo per formattare il testo con tag utente e link URL
  private formatPostContent(text: string): SafeHtml {
    if (!text) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }

    const tagRegex = /@([a-zA-Z0-9_.-]+)/g;
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // Sostituisci prima i link URL
    const textWithLinks = text.replace(urlRegex, (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="post-link">${url}</a>`
    );

    // Poi, sostituisci i tag utente. Assicurati di non toccare i link già formattati.
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

  private updateInfiniteScroll(posts: PostWithUserDetails[]): void {
    if (posts.length > 0) {
      this.lastPostTimestamp = posts[posts.length - 1].timestamp;
    }
    if (posts.length < this.postsLimit) {
      this.canLoadMore = false;
      if (this.infiniteScroll) {
        this.infiniteScroll.disabled = true;
      }
    }
  }

  private handleError(header: string, message: string, infiniteScroll?: IonInfiniteScroll): void {
    this.isLoadingPosts = false;
    this.presentAppAlert(header, message);
    this.canLoadMore = false;
    if (infiniteScroll) {
      infiniteScroll.disabled = true;
      infiniteScroll.complete();
    }
    this.cdr.detectChanges();
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

  getUserPhoto(photoUrl: string | null | undefined): string {
    const defaultGoogleProfilePicture = 'https://lh3.googleusercontent.com/a/ACg8ocK-pW1q9zsWi1DHCcamHuNOTLOvotU44G2v2qtMUtWu3LI0FOE=s96-c';
    if (!photoUrl || photoUrl === '' || photoUrl === defaultGoogleProfilePicture) {
      return 'assets/immaginiGenerali/default-avatar.jpg';
    }
    return photoUrl;
  }

  goToUserProfile(userId: string) {
    if (userId === this.currentUserId) {
      this.router.navigateByUrl('/profilo');
    } else {
      this.router.navigateByUrl(`/profilo-altri-utenti/${userId}`);
    }
  }

  async presentAppAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      cssClass: 'app-alert',
      header: header,
      message: message,
      buttons: [{ text: 'OK', cssClass: 'app-alert-button', role: 'cancel' }],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }

  async openCommentsModal(post: PostWithUserDetails) {
    const modal = await this.modalController.create({
      component: CommentsModalComponent,
      componentProps: {
        postId: post.id,
        postCreatorAvatar: post.userPhoto,
        postCreatorUsername: post.username,
        postText: post.text
      },
      cssClass: 'my-custom-comments-modal',
      mode: 'ios',
      breakpoints: [0, 0.25, 0.5, 0.75, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
    });

    modal.onWillDismiss().then(() => {
      this.updateSinglePost(post.id);
    });

    await modal.present();
  }

  private updateSinglePost(postId: string) {
    if (!postId) return;

    const postIndex = this.posts.findIndex(p => p.id === postId);
    if (postIndex !== -1) {
      this.postService.getPostById(postId).subscribe(updatedPostData => {
        if (updatedPostData) {
          this.addUserDetailsToPosts([updatedPostData]).subscribe(postsWithDetails => {
            if (postsWithDetails.length > 0) {
              this.posts[postIndex] = postsWithDetails[0];
              this.cdr.detectChanges();
            }
          });
        }
      });
    }
  }

  async openLikesModal(post: PostWithUserDetails) {
    const modal = await this.modalController.create({
      component: LikeModalComponent,
      componentProps: {
        postId: post.id,
        postLikes: post.likes,
        usersMap: post.likesUsersMap,
      },
      cssClass: 'my-custom-likes-modal',
      mode: 'ios',
      breakpoints: [0, 0.25, 0.5, 0.75, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
      animated: true,
    });

    modal.onWillDismiss().then(() => {
      this.updateSinglePost(post.id);
    });

    await modal.present();
  }

  async openImageModal(imageUrl: string) {
    // Questo metodo può essere lasciato vuoto o implementato per mostrare l'immagine in un modal.
  }

  getLimitedLikedUsers(likes: string[]): string[] {
    return (likes || []).slice(0, 3);
  }

  //Aggiornato
  getUserAvatarById(userId: string, usersMap?: Map<string, UserDashboardCounts>): string | undefined {
    const userProfile = usersMap?.get(userId) || this.usersCache.get(userId);
    return userProfile ? this.getUserPhoto(userProfile.photo) : undefined;
  }

  getLikedUserName(userId: string, usersMap?: Map<string, UserDashboardCounts>): string {
    const userProfile = usersMap?.get(userId) || this.usersCache.get(userId);
    return userProfile?.nickname || 'Utente sconosciuto';
  }


  async sharePost(post: PostWithUserDetails) {

    const modal = await this.modalController.create({
      component: SearchModalComponent,
      componentProps: {
        postToShare: post,
        isSharingPost: true // ⭐⭐ IMPORTANTE ⭐⭐
      },
      cssClass: 'my-custom-search-modal',
      mode: 'ios',
      breakpoints: [0, 0.5, 0.75, 1],
      initialBreakpoint: 0.75,
      backdropDismiss: true
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    // ⭐⭐ NUOVA LOGICA: Gestisci l'array di ID utenti selezionati ⭐⭐
    if (role === 'chatSelected' && data && data.selectedUserIds && data.selectedUserIds.length > 0) {
      const { selectedUserIds } = data;

      const loading = await this.loadingCtrl.create({
        message: `Invio del post a ${selectedUserIds.length} chat...`,
        spinner: 'crescent'
      });
      await loading.present();

      let successCount = 0;
      let errorCount = 0;

      // Utilizza un ciclo per inviare il post a ogni utente selezionato
      for (const otherParticipantId of selectedUserIds) {
        try {
          const conversationId = await this.chatService.getOrCreateConversation(this.currentUserId!, otherParticipantId);
          const postMessageText = `Ho condiviso un post: ${post.text.substring(0, 50)}...`;

          await this.chatService.sendMessage(
            conversationId,
            this.currentUserId!,
            postMessageText,
            'post',
            {
              id: post.id,
              text: post.text,
              imageUrl: post.imageUrl,
              username: post.username,
              userAvatarUrl: post.userAvatarUrl,
            }
          );
          successCount++;
        } catch (error) {
          console.error(`Errore durante la condivisione in chat con ${otherParticipantId}:`, error);
          errorCount++;
        }
      }
      await loading.dismiss();

      // Mostra il risultato all'utente
      if (errorCount === 0) {
        this.presentAppAlert('Successo', `Il post è stato condiviso in chat con successo con ${successCount} utenti.`);
        this.expService.addExperience(50, 'postShared');
      } else {
        this.presentAppAlert('Condivisione Parziale', `Il post è stato condiviso con ${successCount} utenti, ma ci sono stati errori con ${errorCount} condivisioni.`);
      }
    }
  }
}
