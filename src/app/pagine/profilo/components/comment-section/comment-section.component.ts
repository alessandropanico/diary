import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, SimpleChanges, OnChanges } from '@angular/core';
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
// 1. Devi implementare l'interfaccia OnChanges
export class CommentSectionComponent implements OnInit, OnDestroy, OnChanges {

  @Input() postId!: string;
  @Input() initialCommentsCount: number = 0;

  comments: Comment[] = [];
  newCommentText: string = '';
  currentUserId: string | null = null;
  currentUserUsername: string = 'Eroe Anonimo';
  currentUserAvatar: string = 'assets/immaginiGenerali/default-avatar.jpg';

  isLoadingComments: boolean = false;
  commentsLimit: number = 5;
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
        // 2. Modifica la logica di caricamento dei dati utente:
        // Carica i dati utente solo se non li abbiamo già
        if (!this.currentUserUsername || this.currentUserUsername === 'Eroe Anonimo') {
          this.userDataSubscription = from(this.userDataService.getUserDataByUid(this.currentUserId!)).subscribe({
            next: (userData: UserDashboardCounts | null) => {
              if (userData) {
                this.currentUserUsername = userData.nickname || 'Eroe Anonimo';
                this.currentUserAvatar = userData.photo || userData.profilePictureUrl || 'assets/immaginiGenerali/default-avatar.jpg';
              }
              this.cdr.detectChanges();
              // Chiamiamo resetAndLoadComments qui per gestire il caso iniziale e i dati utente
              this.resetAndLoadComments();
            },
            error: (err) => {
              console.error('Errore nel recupero dati utente (CommentSection):', err);
              this.presentAppAlert('Errore Utente', 'Impossibile caricare i dati del tuo profilo per i commenti.');
              this.cdr.detectChanges();
            }
          });
        } else {
          // Se i dati utente sono già caricati e l'utente è autenticato, ricarichiamo i commenti
          // Questo serve se il componente viene reinizializzato ma l'utente è lo stesso
          this.resetAndLoadComments();
        }
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

  // 3. Aggiungi il metodo ngOnChanges
  ngOnChanges(changes: SimpleChanges): void {
    // Questo hook viene chiamato quando un @Input() cambia.
    // Usiamo 'postId' perché è l'input più critico per il caricamento dei commenti.
    if (changes['postId'] && changes['postId'].currentValue !== changes['postId'].previousValue) {
      if (this.postId) { // Assicurati che il postId sia valido (non nullo/undefined)
        this.resetAndLoadComments();
      } else {
        // Se postId diventa nullo o non definito, pulisci i commenti
        this.comments = [];
        this.canLoadMoreComments = false;
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

  // 4. Aggiungi il nuovo metodo resetAndLoadComments
  private resetAndLoadComments() {
    this.comments = []; // Pulisci i commenti esistenti
    this.lastCommentTimestamp = null; // Resetta il timestamp per la paginazione
    this.canLoadMoreComments = true; // Permetti il caricamento di altri commenti
    this.isLoadingComments = false; // Reset dello stato di caricamento
    this.commentsSubscription?.unsubscribe(); // Annulla la sottoscrizione precedente se presente
    this.cdr.detectChanges(); // Forziamo il rilevamento delle modifiche per aggiornare la UI subito

    // Carica i commenti solo se l'utente è autenticato e abbiamo un postId valido
    if (this.currentUserId && this.postId) {
      this.loadComments();
    }
  }

  loadComments() {
    // 5. Aggiungi un controllo di sicurezza all'inizio di loadComments
    // Questo eviterà di fare chiamate a Firestore se mancano dati essenziali.
    if (!this.postId || !this.currentUserId) {
      console.warn('Impossibile caricare i commenti: postId o currentUserId mancante.', { postId: this.postId, currentUserId: this.currentUserId });
      this.isLoadingComments = false;
      this.canLoadMoreComments = false;
      this.comments = [];
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingComments = true;

    // Qui non devi fare unsubscribe della commentsSubscription, altrimenti rompi la paginazione.
    // L'unsubscribe della sottoscrizione precedente è gestito in `resetAndLoadComments()`.
    this.commentsSubscription = this.commentService.getCommentsForPost(this.postId, this.commentsLimit, this.lastCommentTimestamp)
      .subscribe({
        next: (commentsData) => {
          this.comments = [...this.comments, ...commentsData]; // Aggiungi i nuovi commenti all'array esistente
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
          console.error('Errore nel caricamento dei commenti:', error); // Questa è la riga 116 dell'errore
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

    const commentToAdd: Omit<Comment, 'id' | 'timestamp' | 'likes'> = {
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
        timestamp: new Date().toISOString(),
        likes: [],
      };
      this.comments.unshift(newLocalComment);
      this.newCommentText = '';
      this.expService.addExperience(10, 'commentCreated');
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
    } catch (error) {
      console.error('Errore nell\'eliminazione del commento:', error);
      this.presentAppAlert('Errore', 'Impossibile eliminare il commento.');
    } finally {
      await loading.dismiss();
    }
  }

  async toggleLikeComment(comment: Comment) {
    if (!this.currentUserId) {
      this.presentAppAlert('Accedi Necessario', 'Devi essere loggato per mostrare il tuo apprezzamento!');
      return;
    }

    const hasLiked = comment.likes.includes(this.currentUserId);
    try {
      await this.commentService.toggleLikeComment(this.postId, comment.id, this.currentUserId, !hasLiked);

      if (!hasLiked) {
        comment.likes = [...comment.likes, this.currentUserId];
      } else {
        comment.likes = comment.likes.filter(id => id !== this.currentUserId);
      }
      this.cdr.detectChanges();
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
