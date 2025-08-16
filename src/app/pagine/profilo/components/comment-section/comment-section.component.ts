// src/app/components/comment-section/comment-section.component.ts

import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, SimpleChanges, OnChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, LoadingController, AlertController, IonInfiniteScroll, ModalController } from '@ionic/angular';
import { CommentService } from 'src/app/services/comment.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Comment, CommentFetchResult } from 'src/app/interfaces/comment';
import { Subscription, from } from 'rxjs';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { getAuth } from 'firebase/auth';
import { ExpService } from 'src/app/services/exp.service';
import { Router } from '@angular/router';
import { DocumentSnapshot } from '@angular/fire/firestore';

import { CommentItemComponent } from '../comment-item/comment-item.component';
import { CommentLikesModalComponent } from '../comment-likes-modal/comment-likes-modal.component';
import { Output, EventEmitter } from '@angular/core';
import { Notifica, NotificheService } from 'src/app/services/notifiche.service';

// Nuova interfaccia per i commenti da visualizzare, che include i dati utente aggiornati
export interface CommentWithUserData extends Comment {
  username: string;
  userAvatarUrl: string;
}

// ⭐⭐ NOVITÀ: Creazione di un'interfaccia che rispecchia i dati da salvare
export interface CommentPayload {
  postId: string;
  userId: string;
  text: string;
  parentId: string | null;
}
// ⭐⭐ FINE NOVITÀ ⭐⭐

export interface TagUser {
  uid: string;
  nickname: string;
  fullName?: string;
  photo?: string;
  profilePictureUrl?: string;
}

@Component({
  selector: 'app-comment-section',
  templateUrl: './comment-section.component.html',
  styleUrls: ['./comment-section.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, CommentItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentSectionComponent implements OnInit, OnDestroy, OnChanges {

  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  @Input() postId!: string;
  @Input() initialCommentsCount: number = 0;

  @Output() goToUserProfileEvent = new EventEmitter<string>();

  @Input() postCreatorId!: string;
  @Input() commentIdToHighlight: string | undefined;

  comments: CommentWithUserData[] = [];
  newCommentText: string = '';
  currentUserId: string | null = null;
  currentUserUsername: string = 'Eroe Anonimo';
  currentUserAvatar: string = 'assets/immaginiGenerali/default-avatar.jpg';

  isLoadingComments: boolean = true;
  private commentsLimit: number = 10;
  canLoadMoreComments: boolean = true;

  private commentsSubscription: Subscription | undefined;
  private userDataSubscription: Subscription | undefined;
  private authStateUnsubscribe: (() => void) | undefined;

  replyingToComment: CommentWithUserData | null = null;

  showTaggingSuggestions: boolean = false;
  taggingUsers: TagUser[] = [];
  private searchUserTerm = new Subject<string>();
  private searchUserSubscription: Subscription | undefined;
  public currentSearchText: string = '';

  constructor(
    private commentService: CommentService,
    private userDataService: UserDataService,
    private cdr: ChangeDetectorRef,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private expService: ExpService,
    private router: Router,
    private modalController: ModalController,
    private notificheService: NotificheService
  ) { }

  ngOnInit() {
    this.isLoadingComments = true;
    this.cdr.detectChanges();

    this.authStateUnsubscribe = getAuth().onAuthStateChanged(user => {
      if (user) {
        this.currentUserId = user.uid;
        if (!this.currentUserUsername || this.currentUserUsername === 'Eroe Anonimo') {
          this.userDataSubscription = from(this.userDataService.getUserDataByUid(this.currentUserId!)).subscribe({
            next: (userData: UserDashboardCounts | null) => {
              if (userData) {
                this.currentUserUsername = userData.nickname || 'Eroe Anonimo';
                this.currentUserAvatar = userData.photo || userData.profilePictureUrl || 'assets/immaginiGenerali/default-avatar.jpg';
              }
              this.cdr.detectChanges();
              this.resetAndLoadComments();
            },
            error: (err) => {
              console.error('Errore nel recupero dati utente (CommentSection):', err);
              this.presentAppAlert('Errore Utente', 'Impossibile caricare i dati del tuo profilo per i commenti.');
              this.isLoadingComments = false;
              this.cdr.detectChanges();
              this.resetAndLoadComments();
            }
          });
        } else {
          this.resetAndLoadComments();
        }
      } else {
        this.currentUserId = null;
        this.comments = [];
        this.canLoadMoreComments = false;
        this.isLoadingComments = false;
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
    if (this.searchUserSubscription) {
      this.searchUserSubscription.unsubscribe();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['postId'] && changes['postId'].currentValue !== changes['postId'].previousValue) {
      if (this.postId) {
        this.resetAndLoadComments();
      } else {
        this.comments = [];
        this.canLoadMoreComments = false;
        this.isLoadingComments = false;
        this.cdr.detectChanges();
      }
    }
    if (changes['commentIdToHighlight'] && changes['commentIdToHighlight'].currentValue) {
      this.scrollToHighlightedComment();
    }
  }

  private unsubscribeAll(): void {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }
    if (this.commentsSubscription) {
      this.commentsSubscription.unsubscribe();
    }
    if (this.userDataSubscription) {
      this.userDataSubscription.unsubscribe();
    }
  }

  private resetAndLoadComments() {
    this.isLoadingComments = true;
    this.comments = [];
    this.canLoadMoreComments = true;
    this.commentsSubscription?.unsubscribe();
    this.commentService.resetPagination();

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
      setTimeout(() => {
        if (this.infiniteScroll) {
          this.infiniteScroll.complete();
        }
      }, 0);
    }
    this.cdr.detectChanges();

    if (this.currentUserId && this.postId) {
      this.loadInitialComments();
    } else {
      this.isLoadingComments = false;
      this.cdr.detectChanges();
    }
  }

  private async loadInitialComments() {
    if (!this.postId) {
      this.isLoadingComments = false;
      this.canLoadMoreComments = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      const result: CommentFetchResult = await this.commentService.getCommentsForPostOnce(this.postId, this.commentsLimit);
      this.comments = await this.populateUserData(result.comments);
      this.canLoadMoreComments = result.hasMore;

      if (!this.canLoadMoreComments) {
        if (this.infiniteScroll) {
          this.infiniteScroll.disabled = true;
        }
      }
    } catch (error) {
      console.error('Errore nel caricamento iniziale dei commenti:', error);
      this.presentAppAlert('Errore caricamento commenti', 'Impossibile caricare i commenti iniziali.');
      this.canLoadMoreComments = false;
      if (this.infiniteScroll) {
        this.infiniteScroll.disabled = true;
      }
    } finally {
      this.isLoadingComments = false;
      this.cdr.detectChanges();
      if (this.infiniteScroll) {
        this.infiniteScroll.complete();
      }
      if (this.commentIdToHighlight) {
        this.scrollToHighlightedComment();
      }
    }
  }

  async loadMoreComments(event: any) {
    if (!this.canLoadMoreComments || this.isLoadingComments) {
      event.target.complete();
      return;
    }

    this.isLoadingComments = true;
    this.cdr.detectChanges();

    try {
      const result: CommentFetchResult = await this.commentService.getCommentsForPostOnce(this.postId, this.commentsLimit);

      if (result.comments.length > 0) {
        const newCommentsWithUserData = await this.populateUserData(result.comments);
        const combinedCommentsMap = new Map<string, CommentWithUserData>();
        [...this.comments, ...newCommentsWithUserData].forEach(comment => {
          combinedCommentsMap.set(comment.id, comment);
        });
        this.comments = Array.from(combinedCommentsMap.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }

      this.canLoadMoreComments = result.hasMore;

      if (!this.canLoadMoreComments) {
        if (this.infiniteScroll) {
          this.infiniteScroll.disabled = true;
        }
      }

    } catch (error) {
      console.error('Errore nel caricamento di altri commenti:', error);
      this.presentAppAlert('Errore caricamento commenti', 'Impossibile caricare altri commenti.');
      this.canLoadMoreComments = false;
      if (this.infiniteScroll) {
        this.infiniteScroll.disabled = true;
      }
    } finally {
      this.isLoadingComments = false;
      this.cdr.detectChanges();
      if (event.target) {
        event.target.complete();
      }
    }
  }

  private async populateUserData(comments: Comment[]): Promise<CommentWithUserData[]> {
    if (comments.length === 0) {
      return [];
    }
    const userIds = [...new Set(comments.map(c => c.userId))];

    const userPromises = userIds.map(id => this.userDataService.getUserDataByUid(id));
    const userResults = await Promise.all(userPromises);

    const userMap = new Map<string, UserDashboardCounts | null>();
    userIds.forEach((id, index) => userMap.set(id, userResults[index]));

    return comments.map(comment => {
      const userData = userMap.get(comment.userId);
      const username = userData?.nickname || 'Utente Sconosciuto';
      const userAvatarUrl = userData?.photo || userData?.profilePictureUrl || 'assets/immaginiGenerali/default-avatar.jpg';
      return { ...comment, username, userAvatarUrl } as CommentWithUserData;
    });
  }

  async handleDeleteComment(commentId: string) {
    let commentToDelete: Comment | null = null;
    const loadingInitial = await this.loadingCtrl.create({
      message: 'Recupero dettagli commento...',
      spinner: 'crescent'
    });
    await loadingInitial.present();

    try {
      commentToDelete = await this.commentService.getCommentByIdOnce(this.postId, commentId);

      if (!commentToDelete) {
        console.error('handleDeleteComment: Commento non trovato nel servizio per ID:', commentId);
        this.presentAppAlert('Errore Eliminazione', 'Commento non trovato. Impossibile eliminare.');
        return;
      }
    } catch (error) {
      console.error('Errore nel recupero del commento da eliminare:', error);
      this.presentAppAlert('Errore Eliminazione', 'Impossibile recuperare i dettagli del commento. Riprova.');
      return;
    } finally {
      await loadingInitial.dismiss();
    }

    let confirmMessage: string;
    let deleteFunction: (postId: string, id: string) => Promise<void>;

    if (commentToDelete.parentId === null) {
      confirmMessage = 'Sei sicuro di voler eliminare questo commento e tutte le sue risposte? Questa azione è irreversibile.';
      deleteFunction = (postId, id) => this.commentService.deleteCommentAndReplies(postId, id);
    } else {
      confirmMessage = 'Sei sicuro di voler eliminare solo questa risposta? Questa azione è irreversibile.';
      deleteFunction = (postId, id) => this.commentService.deleteSingleComment(postId, id);
    }

    const alert = await this.alertCtrl.create({
      header: 'Conferma Eliminazione',
      message: confirmMessage,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Elimina',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Eliminazione in corso...',
              spinner: 'crescent'
            });
            await loading.present();
            try {
              await deleteFunction(this.postId, commentToDelete!.id);
              this.resetAndLoadComments();
            } catch (error) {
              console.error('Errore durante l\'eliminazione del commento:', error);
              this.presentAppAlert('Errore', 'Impossibile eliminare il commento.');
            } finally {
              await loading.dismiss();
            }
          }
        }
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }

  setReplyTarget(comment: CommentWithUserData) {
    this.replyingToComment = comment;
    this.newCommentText = `@${comment.username || 'Utente Sconosciuto'} `;
    this.cdr.detectChanges();
  }

  cancelReply() {
    this.replyingToComment = null;
    this.newCommentText = '';
    this.cdr.detectChanges();
  }

  async addCommentOrReply() {
    if (!this.newCommentText.trim() || !this.currentUserId) {
      this.presentAppAlert('Attenzione', 'Il commento non può essere vuoto e devi essere autenticato.');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: this.replyingToComment ? 'Aggiunta risposta...' : 'Aggiunta commento...',
      spinner: 'crescent'
    });
    await loading.present();

    // ⭐⭐ MODIFICA CHIAVE: L'oggetto viene creato senza tipo esplicito
    const commentToAdd = {
      postId: this.postId,
      userId: this.currentUserId,
      text: this.newCommentText.trim(),
      parentId: this.replyingToComment ? this.replyingToComment.id : null
    };

    try {
      // ⭐⭐ MODIFICA: La funzione addComment ora accetta l'oggetto appena creato
      const addedCommentId = await this.commentService.addComment(commentToAdd as any);
      this.expService.addExperience(10, 'commentCreated');

      if (this.currentUserId !== this.postCreatorId && this.postCreatorId) {
      const notificaPerAutore: Omit<Notifica, 'id' | 'dataCreazione' | 'timestamp'> = {
        userId: this.postCreatorId,
        titolo: 'Nuovo commento',
        messaggio: `${this.currentUserUsername} ha commentato il tuo post.`,
        postId: this.postId,
        commentId: addedCommentId,
        letta: false,
        tipo: 'commento'
    };
    await this.notificheService.aggiungiNotifica(notificaPerAutore);
      }

      await this.checkForMentionsAndNotify(addedCommentId);

      this.newCommentText = '';
      this.replyingToComment = null;
      this.resetAndLoadComments();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Errore nell\'aggiunta del commento:', error);
      this.presentAppAlert('Errore', 'Impossibile aggiungere il commento.');
    } finally {
      await loading.dismiss();
    }
  }

  private async checkForMentionsAndNotify(commentId: string) {
    const mentionRegex = /@(\w+)/g;
    const mentions = this.newCommentText.match(mentionRegex);

    if (mentions && this.currentUserId) {
      const uniqueMentions = [...new Set(mentions.map(m => m.substring(1)))];

      for (const nickname of uniqueMentions) {
        try {
          const taggedUserId = await this.userDataService.getUidByNickname(nickname);
          if (taggedUserId && taggedUserId !== this.currentUserId) {
            await this.notificheService.aggiungiNotificaMenzioneCommento(taggedUserId, this.currentUserUsername, this.postId, commentId);
          }
        } catch (error) {
          console.warn(`Impossibile trovare l'utente con nickname @${nickname}. Nessuna notifica inviata.`, error);
        }
      }
    }
  }

  async toggleLikeComment(commentToToggle: CommentWithUserData) {
    if (!this.currentUserId) {
      this.presentAppAlert('Accedi Necessario', 'Devi essere loggato per mostrare il tuo apprezzamento!');
      return;
    }

    const hasLiked = commentToToggle.likes.includes(this.currentUserId);
    const newLikeState = !hasLiked;

    try {
      await this.commentService.toggleLikeComment(this.postId, commentToToggle.id, this.currentUserId, newLikeState);

      if (newLikeState && this.currentUserId !== commentToToggle.userId) {
        const likerUserData = await this.userDataService.getUserDataByUid(this.currentUserId);
        const likerUsername = likerUserData?.nickname || 'Un utente';

        await this.notificheService.aggiungiNotifica({
          userId: commentToToggle.userId,
          titolo: 'Nuovo "Mi piace"!',
          messaggio: `${likerUsername} ha messo mi piace al tuo commento.`,
          tipo: 'mi_piace_commento',
          postId: this.postId,
          commentId: commentToToggle.id,
          letta: false,
        });
      }

      const updateLikesRecursively = (commentsArray: CommentWithUserData[], targetCommentId: string, userId: string, liked: boolean): CommentWithUserData[] => {
        return commentsArray.map(c => {
          if (c.id === targetCommentId) {
            const updatedLikes = liked ?
              (c.likes.includes(userId) ? c.likes : [...c.likes, userId]) :
              c.likes.filter(id => id !== userId);
            return { ...c, likes: updatedLikes };
          }
          if (c.replies && c.replies.length > 0) {
            const updatedReplies = updateLikesRecursively(c.replies, targetCommentId, userId, liked);
            if (updatedReplies !== c.replies) {
              return { ...c, replies: updatedReplies };
            }
          }
          return c;
        });
      };

      this.comments = updateLikesRecursively(this.comments, commentToToggle.id, this.currentUserId, newLikeState);
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Errore nel toggle like del commento:', error);
      this.presentAppAlert('Errore', 'Impossibile aggiornare il "Mi piace" del commento. Riprova.');
    }
  }

  async handleGoToProfile(identifier: string) {
    let uidToNavigate: string | null = identifier;
    const isLikelyNickname = identifier.length < 20 || identifier.includes('-') || identifier.includes('.');

    if (isLikelyNickname) {
      const loading = await this.loadingCtrl.create({
        message: 'Ricerca utente...',
        spinner: 'dots',
        duration: 3000
      });
      await loading.present();

      try {
        uidToNavigate = await this.userDataService.getUidByNickname(identifier);
      } catch (error) {
        console.error(`Errore nel risolvere nickname '${identifier}':`, error);
        this.presentAppAlert('Errore', `Impossibile trovare l'utente con nickname @${identifier}.`);
        uidToNavigate = null;
      } finally {
        await loading.dismiss();
      }
    } else {
    }

    if (uidToNavigate) {
      this.goToUserProfileEvent.emit(uidToNavigate);
    } else {
      console.warn(`CommentSectionComponent: Impossibile navigare. UID non disponibile per l'identifier: ${identifier}`);
    }
  }

  formatCommentTime(timestamp: string): string {
    if (!timestamp) return '';

    try {
      const commentDate = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - commentDate.getTime();

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
      console.error("Errore nel formato data commento:", timestamp, e);
      return new Date(timestamp).toLocaleDateString('it-IT', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

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

    const text = this.newCommentText;
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


  async presentAppAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      cssClass: 'app-alert',
      header: header,
      message: message,
      buttons: [
        { text: 'OK', cssClass: 'app-alert-button', role: 'cancel' }
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }

  private removeDuplicates(comments: Comment[]): Comment[] {
    const ids = new Set<string>();
    return comments.filter(comment => {
      if (ids.has(comment.id)) {
        return false;
      }
      ids.add(comment.id);
      return true;
    });
  }

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
    const text = this.newCommentText;
    const atIndex = text.lastIndexOf('@');

    if (atIndex !== -1) {
      const prefix = text.substring(0, atIndex);
      this.newCommentText = `${prefix}@${user.nickname} `;
    } else {
      this.newCommentText = `@${user.nickname} `;
    }

    this.showTaggingSuggestions = false;
    this.taggingUsers = [];
    this.currentSearchText = '';

    this.cdr.detectChanges();
    const textarea = document.querySelector('.comment-textarea textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(this.newCommentText.length, this.newCommentText.length);
    }
  }

  async openCommentLikesModal(comment: CommentWithUserData) {
    if (comment.likes.length === 0) {
      return;
    }

    const modal = await this.modalController.create({
      component: CommentLikesModalComponent,
      componentProps: {
        postId: comment.postId,
        commentId: comment.id
      },
      cssClass: 'likes-modal',
      mode: 'ios',
      breakpoints: [0, 0.5, 0.8],
      initialBreakpoint: 0.8,
      backdropDismiss: true
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data && data.dismissed) {
    }
  }

  private scrollToHighlightedComment() {
    if (!this.commentIdToHighlight) {
      return;
    }
    setTimeout(() => {
      const element = document.getElementById(`comment-${this.commentIdToHighlight}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('highlighted-comment');
        setTimeout(() => {
          element.classList.remove('highlighted-comment');
        }, 5000);
      }
    }, 100);
  }
}
