import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, SimpleChanges, OnChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, LoadingController, AlertController, IonInfiniteScroll } from '@ionic/angular';
import { CommentService } from 'src/app/services/comment.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Comment } from 'src/app/interfaces/comment';
import { Subscription, from } from 'rxjs';
import { getAuth } from 'firebase/auth';
import { ExpService } from 'src/app/services/exp.service';
import { Router } from '@angular/router';
import { DocumentSnapshot } from '@angular/fire/firestore';

@Component({
  selector: 'app-comment-section',
  templateUrl: './comment-section.component.html',
  styleUrls: ['./comment-section.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentSectionComponent implements OnInit, OnDestroy, OnChanges {

  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  @Input() postId!: string;
  @Input() initialCommentsCount: number = 0;

  comments: Comment[] = [];
  newCommentText: string = '';
  currentUserId: string | null = null;
  currentUserUsername: string = 'Eroe Anonimo';
  currentUserAvatar: string = 'assets/immaginiGenerali/default-avatar.jpg';

  isLoadingComments: boolean = false;
  private commentsLimit: number = 10;
  private lastVisibleDocSnapshot: DocumentSnapshot | null = null;
  canLoadMoreComments: boolean = true;

  private commentsSubscription: Subscription | undefined;
  private userDataSubscription: Subscription | undefined;
  private authStateUnsubscribe: (() => void) | undefined;

  replyingToComment: Comment | null = null;

  constructor(
    private commentService: CommentService,
    private userDataService: UserDataService,
    private cdr: ChangeDetectorRef,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private expService: ExpService,
    private router: Router
  ) { }

  ngOnInit() {
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
              this.cdr.detectChanges();
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
  }

  ngOnDestroy(): void {
    this.unsubscribeAll();
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
    this.lastVisibleDocSnapshot = null;
    this.canLoadMoreComments = true;
    this.commentsSubscription?.unsubscribe();

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
      this.infiniteScroll.complete();
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
    this.isLoadingComments = true;
    this.comments = [];
    this.lastVisibleDocSnapshot = null;
    this.canLoadMoreComments = true;
    this.cdr.detectChanges();

    try {
      const result = await this.commentService.getCommentsForPostOnce(this.postId, this.commentsLimit, null);
      this.comments = result.comments;
      this.lastVisibleDocSnapshot = result.lastDoc;
      this.isLoadingComments = false;

      if (result.comments.length < this.commentsLimit) {
        this.canLoadMoreComments = false;
        if (this.infiniteScroll) {
          this.infiniteScroll.disabled = true;
        }
      }
    } catch (error) {
      console.error('Errore nel caricamento iniziale dei commenti:', error);
      this.isLoadingComments = false;
      this.presentAppAlert('Errore caricamento commenti', 'Impossibile caricare i commenti iniziali.');
      this.canLoadMoreComments = false;
      if (this.infiniteScroll) {
        this.infiniteScroll.disabled = true;
      }
    } finally {
      this.cdr.detectChanges();
      if (this.infiniteScroll) {
        this.infiniteScroll.complete();
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
      const result = await this.commentService.getCommentsForPostOnce(this.postId, this.commentsLimit, this.lastVisibleDocSnapshot);

      if (result.comments.length > 0) {
        this.comments = [...this.comments, ...result.comments];
        this.comments = this.removeDuplicates(this.comments);
        this.lastVisibleDocSnapshot = result.lastDoc;
      }

      if (result.comments.length < this.commentsLimit) {
        this.canLoadMoreComments = false;
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
      event.target.complete();
    }
  }

  setReplyTarget(comment: Comment) {
    this.replyingToComment = comment;
    this.newCommentText = `@${comment.username} `;
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

    const commentToAdd: Omit<Comment, 'id' | 'timestamp' | 'likes' | 'replies'> = {
      postId: this.postId,
      userId: this.currentUserId,
      username: this.currentUserUsername,
      userAvatarUrl: this.currentUserAvatar,
      text: this.newCommentText.trim(),
      parentId: this.replyingToComment ? this.replyingToComment.id : null
    };

    try {
      await this.commentService.addComment(commentToAdd);
      this.newCommentText = '';
      this.replyingToComment = null;
      this.expService.addExperience(10, 'commentCreated');
      // Dopo aver aggiunto un commento, ricarica i commenti per includerlo
      // E potenzialmente resetta la paginazione per mostrare il nuovo commento in cima
      this.resetAndLoadComments(); // Questo aggiornerà la lista con il nuovo commento
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Errore nell\'aggiunta del commento:', error);
      this.presentAppAlert('Errore', 'Impossibile aggiungere il commento.');
    } finally {
      await loading.dismiss();
    }
  }

  async presentDeleteCommentAlert(commentId: string) {
    const alert = await this.alertCtrl.create({
      cssClass: 'app-alert',
      header: 'Conferma Eliminazione Commento',
      message: 'Sei sicuro di voler eliminare questo commento?',
      buttons: [
        { text: 'Annulla', role: 'cancel', cssClass: 'app-alert-button cancel-button' },
        {
          text: 'Elimina',
          cssClass: 'app-alert-button delete-button',
          handler: async () => { await this.deleteComment(commentId); }
        }
      ],
      backdropDismiss: true,
      animated: true,
      mode: 'ios'
    });
    await alert.present();
  }

  async deleteComment(commentId: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Eliminazione commento...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await this.commentService.deleteComment(this.postId, commentId);
      this.presentAppAlert('Commento Eliminato', 'Il commento è stato rimosso.');
      // Dopo aver eliminato un commento, ricarica la lista per riflettere il cambiamento
      this.resetAndLoadComments();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Errore nell\'eliminazione del commento:', error);
      this.presentAppAlert('Errore', `Impossibile eliminare il commento: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Gestisce l'aggiunta o la rimozione di un "Mi piace" a un commento o a una risposta.
   * Aggiorna lo stato localmente per evitare il ricaricamento completo.
   */
  async toggleLikeComment(comment: Comment) {
    if (!this.currentUserId) {
      this.presentAppAlert('Accedi Necessario', 'Devi essere loggato per mostrare il tuo apprezzamento!');
      return;
    }

    const hasLiked = comment.likes.includes(this.currentUserId);
    try {
      await this.commentService.toggleLikeComment(this.postId, comment.id, this.currentUserId, !hasLiked);

      // --- INIZIO MODIFICA QUI ---
      // Trova il commento nell'array locale e aggiorna i suoi like
      const updateLikes = (commentArray: Comment[], commentIdToFind: string, userId: string, liked: boolean): boolean => {
        for (let i = 0; i < commentArray.length; i++) {
          const c = commentArray[i];
          if (c.id === commentIdToFind) {
            if (liked) {
              if (!c.likes.includes(userId)) {
                c.likes = [...c.likes, userId];
              }
            } else {
              c.likes = c.likes.filter(id => id !== userId);
            }
            // Importante: Creare un nuovo oggetto commento per innescare ChangeDetection
            // Se non crei un nuovo oggetto o un nuovo array, Angular potrebbe non rilevare la modifica
            // se ChangeDetectionStrategy.OnPush è attivo in modo rigoroso.
            commentArray[i] = { ...c };
            return true; // Commento principale trovato e aggiornato
          }

          // Cerca nelle risposte (se il commento ha risposte)
          if (c.replies && c.replies.length > 0) {
            if (updateLikes(c.replies, commentIdToFind, userId, liked)) {
              // Se la risposta è stata aggiornata, dobbiamo ricreare l'oggetto commento principale
              // per assicurarci che l'array `replies` venga considerato modificato da Angular.
              commentArray[i] = { ...c, replies: [...c.replies] }; // Ricreo l'array delle risposte
              return true;
            }
          }
        }
        return false;
      };

      // Chiamiamo la funzione ricorsiva sull'array principale dei commenti
      updateLikes(this.comments, comment.id, this.currentUserId, !hasLiked);

      this.cdr.detectChanges(); // Forzo il rilevamento dei cambiamenti per aggiornare la UI
      // --- FINE MODIFICA QUI ---

    } catch (error) {
      console.error('Errore nel toggle like del commento:', error);
      this.presentAppAlert('Errore', 'Impossibile aggiornare il "Mi piace" del commento. Riprova.');
    }
  }

  goToUserProfile(userId: string) {
    if (userId === this.currentUserId) {
      this.router.navigateByUrl('/profile');
    } else {
      this.router.navigateByUrl(`/profile/${userId}`);
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
}
