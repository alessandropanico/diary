import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Post } from 'src/app/interfaces/post';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { PostService } from 'src/app/services/post.service';
import { CommentService } from 'src/app/services/comment.service';
import { ExpService } from 'src/app/services/exp.service';
import { getAuth } from 'firebase/auth';
import { AlertController, LoadingController, ModalController } from '@ionic/angular';
import { CommentsModalComponent } from '../profilo/components/comments-modal/comments-modal.component';
import { LikeModalComponent } from '../profilo/components/like-modal/like-modal.component';
import { from, combineLatest, of, Subscription } from 'rxjs';
import { map, switchMap, catchError, take } from 'rxjs/operators';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'; // ⭐ NUOVO: Importa DomSanitizer e SafeHtml

import { ChatService } from 'src/app/services/chat.service'; // ⭐ AGGIUNGI QUESTO IMPORT ⭐
import { SearchModalComponent } from 'src/app/shared/search-modal/search-modal.component';

interface PostWithUserDetails extends Post {
  likesUsersMap?: Map<string, UserDashboardCounts>;
  formattedText?: SafeHtml; // ⭐ NUOVO: Aggiungi formattedText all'interfaccia
  userAvatarUrl: string; // Aggiungi userAvatarUrl per coerenza con il template
  username: string; // Aggiungi username per coerenza
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
  commentIdToHighlight: string | null = null;

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
    private sanitizer: DomSanitizer,
    private chatService: ChatService,
    private loadingCtrl: LoadingController,
  ) { }

  ngOnInit() {
    getAuth().onAuthStateChanged(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.activatedRoute.paramMap.subscribe(params => {
          this.notiziaId = params.get('id');
          this.commentIdToHighlight = params.get('commentId');
          this.loadSinglePost();
        });
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

      const postAuthorData = await this.userDataService.getUserDataByUid(postData.userId);
      if (postAuthorData) {
        this.usersCache.set(postData.userId, postAuthorData);
      }

      const likedUserIds = (postData.likes || []).slice(0, 3);
      const allUserIdsToFetch = new Set<string>();
      if (this.currentUserId) {
        allUserIdsToFetch.add(this.currentUserId);
      }
      likedUserIds.forEach(id => allUserIdsToFetch.add(id));

      const userPromises = Array.from(allUserIdsToFetch).map(userId =>
        from(this.userDataService.getUserDataByUid(userId)).pipe(
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
        )
      );

      this.postSubscription = combineLatest(userPromises.length > 0 ? userPromises : [of(null)]).pipe(
        map(userProfiles => {
          const likedUsersMap = new Map<string, UserDashboardCounts>();
          userProfiles.forEach(profile => {
            if (profile && likedUserIds.includes(profile.uid)) {
              likedUsersMap.set(profile.uid, profile);
            }
          });

          // Recupera i dati dell'autore del post dalla cache o dal servizio
          const authorData = this.usersCache.get(postData.userId);

          // ⭐ MODIFICA: Aggiungi il testo formattato e i dettagli dell'autore al post
          this.notizia = {
            ...postData,
            likesUsersMap: likedUsersMap,
            username: authorData?.nickname || 'Utente Sconosciuto',
            userAvatarUrl: this.getUserPhoto(authorData?.photo),
            formattedText: this.formatPostContent(postData.text)
          } as PostWithUserDetails;

          this.isLoadingPost = false;
          this.cdr.detectChanges();

          if (this.commentIdToHighlight && this.notizia) {
            this.openCommentsModal(this.notizia);
          }
        })
      ).subscribe();
    } else {
      this.notizia = null;
      this.isLoadingPost = false;
      this.cdr.detectChanges();
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

  async openCommentsModal(post: PostWithUserDetails) { // Usa l'interfaccia aggiornata
    const modal = await this.modalController.create({
      component: CommentsModalComponent,
      componentProps: {
        postId: post.id,
        postCreatorAvatar: post.userAvatarUrl,
        postCreatorUsername: post.username,
        postCreatorId: post.userId,
        postText: post.text,
        commentIdToHighlight: this.commentIdToHighlight
      },
      cssClass: 'my-custom-comments-modal',
      mode: 'ios',
      breakpoints: [0, 0.25, 0.5, 0.75, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
    });
    modal.onWillDismiss().then(() => {
      this.commentIdToHighlight = null;
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
      animated: true,
    });

    modal.onWillDismiss().then(() => {
      this.loadSinglePost();
      this.cdr.detectChanges();
    });

    await modal.present();
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
      this.router.navigateByUrl(`/profilo-altri-utenti/${userId}`);
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
    return userProfile ? this.getUserPhoto(userProfile.photo) : undefined;
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
