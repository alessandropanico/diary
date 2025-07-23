import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, LoadingController, AlertController } from '@ionic/angular';
import { CommentService } from 'src/app/services/comment.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Comment } from 'src/app/interfaces/comment';
import { Subscription, from } from 'rxjs';
import { getAuth } from 'firebase/auth';
import { ExpService } from 'src/app/services/exp.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-comment-section',
  templateUrl: './comment-section.component.html',
  styleUrls: ['./comment-section.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentSectionComponent implements OnInit, OnDestroy {
  @Input() postId!: string;
  @Input() initialCommentsCount: number = 0; // Ricevi il conteggio iniziale dal post

  comments: Comment[] = [];
  newCommentText: string = '';
  currentUserId: string | null = null;
  currentUserUsername: string = 'Eroe Anonimo';
  currentUserAvatar: string = 'assets/immaginiGenerali/default-avatar.jpg';

  isLoadingComments: boolean = false;
  commentsLimit: number = 5; // Carica 5 commenti alla volta
  lastCommentTimestamp: string | null = null;
  canLoadMoreComments: boolean = true;

  private commentsSubscription: Subscription | undefined;
  private userDataSubscription: Subscription | undefined;
  private authStateUnsubscribe: (() => void) | undefined;

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
        this.userDataSubscription = from(this.userDataService.getUserDataByUid(this.currentUserId!)).subscribe({
          next: (userData: UserDashboardCounts | null) => {
            if (userData) {
              this.currentUserUsername = userData.nickname || 'Eroe Anonimo';
              this.currentUserAvatar = userData.photo || userData.profilePictureUrl || 'assets/immaginiGenerali/default-avatar.jpg';
            }
            this.cdr.detectChanges();
            this.loadComments(); // Carica i commenti solo dopo aver avuto i dati utente
          },
          error: (err) => {
            console.error('Errore nel recupero dati utente (CommentSection):', err);
            this.presentAppAlert('Errore Utente', 'Impossibile caricare i dati del tuo profilo per i commenti.');
            this.cdr.detectChanges();
          }
        });
      } else {
        this.currentUserId = null;
        this.comments = [];
        this.canLoadMoreComments = false;
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
    if (this.commentsSubscription) {
      this.commentsSubscription.unsubscribe();
    }
    if (this.userDataSubscription) {
      this.userDataSubscription.unsubscribe();
    }
  }

  loadComments() {
    if (!this.postId) return;

    this.isLoadingComments = true;
    this.commentsSubscription?.unsubscribe();

    this.commentService.getCommentsForPost(this.postId, this.commentsLimit, this.lastCommentTimestamp)
      .subscribe({
        next: (commentsData) => {
          this.comments = [...this.comments, ...commentsData];
          this.isLoadingComments = false;
          if (commentsData.length < this.commentsLimit) {
            this.canLoadMoreComments = false;
          }
          if (commentsData.length > 0) {
            this.lastCommentTimestamp = commentsData[commentsData.length - 1].timestamp;
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Errore nel caricamento dei commenti:', error);
          this.isLoadingComments = false;
          this.presentAppAlert('Errore caricamento commenti', 'Impossibile caricare i commenti.');
          this.canLoadMoreComments = false;
          this.cdr.detectChanges();
        }
      });
  }

  async addComment() {
    if (!this.newCommentText.trim() || !this.currentUserId) {
      this.presentAppAlert('Attenzione', 'Il commento non può essere vuoto e devi essere autenticato.');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Aggiunta commento...',
      spinner: 'crescent'
    });
    await loading.present();

    const commentToAdd: Omit<Comment, 'id' | 'timestamp' | 'likes'> = { // Modificato il tipo qui
      postId: this.postId,
      userId: this.currentUserId,
      username: this.currentUserUsername,
      userAvatarUrl: this.currentUserAvatar,
      text: this.newCommentText.trim(),
    };

    try {
      const commentId = await this.commentService.addComment(commentToAdd);
      // Simula l'aggiunta locale del commento per feedback immediato
      const newLocalComment: Comment = {
        ...commentToAdd,
        id: commentId,
        timestamp: new Date().toISOString(), // Usa data locale per visualizzazione immediata
        likes: [], // AGGIUNTO: Inizializza likes per il commento aggiunto localmente
      };
      this.comments.unshift(newLocalComment); // Aggiungi in cima
      this.newCommentText = '';
      this.expService.addExperience(10, 'commentCreated');
      // Aggiorna il conteggio (vedi nota su Cloud Functions)
      // await this.commentService.updateCommentCount(this.postId, 1);
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
        {
          text: 'Annulla',
          role: 'cancel',
          cssClass: 'app-alert-button cancel-button',
        },
        {
          text: 'Elimina',
          cssClass: 'app-alert-button delete-button',
          handler: async () => {
            await this.deleteComment(commentId);
          }
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
      this.comments = this.comments.filter(c => c.id !== commentId);
      this.cdr.detectChanges();
      this.presentAppAlert('Commento Eliminato', 'Il commento è stato rimosso.');
      // Aggiorna il conteggio (vedi nota su Cloud Functions)
      // await this.commentService.updateCommentCount(this.postId, -1);
    } catch (error) {
      console.error('Errore nell\'eliminazione del commento:', error);
      this.presentAppAlert('Errore', 'Impossibile eliminare il commento.');
    } finally {
      await loading.dismiss();
    }
  }

  // NUOVA FUNZIONE: Toggle Mi Piace per un commento
  async toggleLikeComment(comment: Comment) {
    if (!this.currentUserId) {
      this.presentAppAlert('Accedi Necessario', 'Devi essere loggato per mostrare il tuo apprezzamento!');
      return;
    }

    const hasLiked = comment.likes.includes(this.currentUserId);
    try {
      await this.commentService.toggleLikeComment(this.postId, comment.id, this.currentUserId, !hasLiked);

      // Aggiorna localmente l'array dei like per feedback immediato
      if (!hasLiked) {
        comment.likes = [...comment.likes, this.currentUserId];
      } else {
        comment.likes = comment.likes.filter(id => id !== this.currentUserId);
      }
      this.cdr.detectChanges(); // Forziamo il rilevamento per aggiornare la UI
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
    // ... (funzione già esistente) ...
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
}
