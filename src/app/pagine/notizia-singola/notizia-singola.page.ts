import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Post } from 'src/app/interfaces/post';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { PostService } from 'src/app/services/post.service';
import { CommentService } from 'src/app/services/comment.service';
import { ExpService } from 'src/app/services/exp.service';
import { getAuth } from 'firebase/auth';
import { AlertController, ModalController } from '@ionic/angular';
import { CommentsModalComponent } from '../profilo/components/comments-modal/comments-modal.component';
import { LikeModalComponent } from '../profilo/components/like-modal/like-modal.component';
import { from, combineLatest, of, Subscription } from 'rxjs';
import { map, switchMap, catchError, take } from 'rxjs/operators';


interface PostWithUserDetails extends Post {
  likesUsersMap?: Map<string, UserDashboardCounts>;
}

@Component({
  selector: 'app-notizia-singola',
  templateUrl: './notizia-singola.page.html',
  styleUrls: ['./notizia-singola.page.scss'],
  standalone: false,
})
export class NotiziaSingolaPage implements OnInit, OnDestroy {

  notiziaId: string | null = null;
  notizia: PostWithUserDetails | null = null;
  isLoadingPost: boolean = true;
  currentUserId: string | null = null;

  private postSubscription: Subscription | undefined;
  private usersCache: Map<string, UserDashboardCounts> = new Map();

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private postService: PostService,
    private userDataService: UserDataService,
    private commentService: CommentService,
    private expService: ExpService,
    private alertCtrl: AlertController,
    private modalController: ModalController,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    getAuth().onAuthStateChanged(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.notiziaId = this.activatedRoute.snapshot.paramMap.get('id');
        this.loadSinglePost();
      } else {
        this.currentUserId = null;
        this.notizia = null;
        this.isLoadingPost = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.postSubscription) {
      this.postSubscription.unsubscribe();
    }
  }

  async loadSinglePost() {
    if (!this.notiziaId) {
      this.isLoadingPost = false;
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingPost = true;
    const postRef = doc(this.firestore, `posts/${this.notiziaId}`);
    const postSnap = await getDoc(postRef);

    if (postSnap.exists()) {
      const postData = { id: postSnap.id, ...postSnap.data() } as Post;
      const likedUserIds = (postData.likes || []).slice(0, 3);
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

      this.postSubscription = combineLatest(userPromises.length > 0 ? userPromises : [of(null)]).pipe(
        map(likedUsersProfiles => {
          const likedUsersMap = new Map<string, UserDashboardCounts>();
          likedUsersProfiles.forEach(profile => {
            if (profile) {
              likedUsersMap.set(profile.uid, profile);
            }
          });
          this.notizia = { ...postData, likesUsersMap: likedUsersMap } as PostWithUserDetails;
          this.isLoadingPost = false;
          this.cdr.detectChanges();
        })
      ).subscribe();
    } else {
      this.notizia = null;
      this.isLoadingPost = false;
      this.cdr.detectChanges();
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
    modal.onWillDismiss().then(() => {
      this.loadSinglePost();
    });
    await modal.present();
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
    });

    modal.onWillDismiss().then(() => {
      this.loadSinglePost();
      this.cdr.detectChanges();
    });

    await modal.present();
  }

  async sharePost(post: Post) {
    const appLink = 'https://alessandropanico.github.io/Sito-Portfolio/';
    const postSpecificLink = `${appLink}#/notizia/${post.id}`;
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

  formatTextWithLinks(text: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="post-link">${url}</a>`);
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

  getLimitedLikedUsers(likes: string[]): string[] {
    return (likes || []).slice(0, 3);
  }

  getUserAvatarById(userId: string, usersMap?: Map<string, UserDashboardCounts>): string | undefined {
    const userProfile = usersMap?.get(userId) || this.usersCache.get(userId);
    return userProfile ? this.getUserPhoto(userProfile.profilePictureUrl || userProfile.photo) : undefined;
  }

  getLikedUserName(userId: string, usersMap?: Map<string, UserDashboardCounts>): string {
    const userProfile = usersMap?.get(userId) || this.usersCache.get(userId);
    return userProfile?.nickname || 'Utente sconosciuto';
  }

  getUserPhoto(photoUrl: string | null | undefined): string {
    const defaultGoogleProfilePicture = 'https://lh3.googleusercontent.com/a/ACg8ocK-pW1q9zsWi1DHCcamHuNOTLOvotU44G2v2qtMUtWu3LI0FOE=s96-c';
    if (!photoUrl || photoUrl === '' || photoUrl === defaultGoogleProfilePicture) {
      return 'assets/immaginiGenerali/default-avatar.jpg';
    }
    return photoUrl;
  }
}
