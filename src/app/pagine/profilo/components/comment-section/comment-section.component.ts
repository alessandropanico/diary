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
import { DocumentSnapshot, collection, query, orderBy, where, limit, getDocs } from '@angular/fire/firestore'; // Importa getDocs, collection, query, ecc. anche qui per la paginazione locale

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
  @Input() initialCommentsCount: number = 0; // Se necessario per visualizzazione, altrimenti può essere rimosso

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
        // Carica i dati utente solo se non sono già disponibili o sono al valore di default
        if (!this.currentUserUsername || this.currentUserUsername === 'Eroe Anonimo') {
          this.userDataSubscription = from(this.userDataService.getUserDataByUid(this.currentUserId!)).subscribe({
            next: (userData: UserDashboardCounts | null) => {
              if (userData) {
                this.currentUserUsername = userData.nickname || 'Eroe Anonimo';
                this.currentUserAvatar = userData.photo || userData.profilePictureUrl || 'assets/immaginiGenerali/default-avatar.jpg';
              }
              this.cdr.detectChanges(); // Aggiorna la UI con i dati utente
              this.resetAndLoadComments(); // Carica i commenti dopo aver ottenuto i dati utente
            },
            error: (err) => {
              console.error('Errore nel recupero dati utente (CommentSection):', err);
              this.presentAppAlert('Errore Utente', 'Impossibile caricare i dati del tuo profilo per i commenti.');
              this.cdr.detectChanges();
            }
          });
        } else {
          // Se i dati utente sono già presenti, procedi a caricare i commenti
          this.resetAndLoadComments();
        }
      } else {
        // Utente disconnesso
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
    // Rileva i cambiamenti nell'Input postId per ricaricare i commenti
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

  /**
   * Resetta lo stato del componente e avvia la sottoscrizione reattiva per i commenti iniziali.
   */
  private resetAndLoadComments() {
    this.isLoadingComments = true;
    this.comments = [];
    this.lastVisibleDocSnapshot = null; // Resetta il riferimento per la paginazione
    this.canLoadMoreComments = true;
    this.commentsSubscription?.unsubscribe(); // Annulla sottoscrizioni precedenti

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
      this.infiniteScroll.complete();
    }
    this.cdr.detectChanges(); // Forzo l'aggiornamento per mostrare lo stato di caricamento

    if (this.currentUserId && this.postId) {
      this.commentsSubscription = this.commentService.getCommentsForPost(this.postId, this.commentsLimit).subscribe({
        next: async (commentsData) => {
          this.comments = commentsData;
          this.isLoadingComments = false;
          this.cdr.detectChanges();

          if (commentsData.length < this.commentsLimit) {
            this.canLoadMoreComments = false;
            if (this.infiniteScroll) {
              this.infiniteScroll.disabled = true;
            }
          } else if (commentsData.length > 0) {
            // Se sono stati caricati commenti (fino al limite),
            // recuperiamo il DocumentSnapshot dell'ultimo commento per la paginazione successiva.
            // Questo è necessario perché `getCommentsForPost` restituisce solo i dati mappati.
            const lastComment = commentsData[commentsData.length - 1];
            const commentsCollectionRef = collection(this.commentService['firestore'], `posts/${this.postId}/comments`);
            const q = query(
              commentsCollectionRef,
              orderBy('timestamp', 'desc'),
              where('timestamp', '==', new Date(lastComment.timestamp)),
              limit(1)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              this.lastVisibleDocSnapshot = snapshot.docs[0];
            }
          }
        },
        error: (error) => {
          console.error('Errore nel caricamento dei commenti:', error);
          this.isLoadingComments = false;
          this.presentAppAlert('Errore caricamento commenti', 'Impossibile caricare i commenti.');
          this.canLoadMoreComments = false;
          if (this.infiniteScroll) {
            this.infiniteScroll.disabled = true;
          }
          this.cdr.detectChanges();
        }
      });
    } else {
      this.isLoadingComments = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Carica altri commenti usando la paginazione, attivato dall'infinite scroll.
   */
  async loadMoreComments(event: any) {
    if (!this.canLoadMoreComments || this.isLoadingComments) {
      event.target.complete();
      return;
    }

    this.isLoadingComments = true;
    this.cdr.detectChanges();

    try {
      const newComments = await this.commentService.getCommentsForPostOnce(this.postId, this.commentsLimit, this.lastVisibleDocSnapshot);

      if (newComments.length > 0) {
        this.comments = [...this.comments, ...newComments];
        this.comments = this.removeDuplicates(this.comments); // Rimuovi duplicati (prevenzione)

        // Aggiorna lastVisibleDocSnapshot per la prossima chiamata
        const lastComment = newComments[newComments.length - 1];
        const commentsCollectionRef = collection(this.commentService['firestore'], `posts/${this.postId}/comments`);
        const q = query(
          commentsCollectionRef,
          orderBy('timestamp', 'desc'),
          where('timestamp', '==', new Date(lastComment.timestamp)),
          limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          this.lastVisibleDocSnapshot = snapshot.docs[0];
        }

      }

      if (newComments.length < this.commentsLimit) {
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

  /**
   * Aggiunge un nuovo commento al post.
   */
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
      await this.commentService.addComment(commentToAdd);
      this.newCommentText = '';
      this.expService.addExperience(10, 'commentCreated');
      // La lista dei commenti si aggiornerà automaticamente grazie alla sottoscrizione reattiva
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Errore nell\'aggiunta del commento:', error);
      this.presentAppAlert('Errore', 'Impossibile aggiungere il commento.');
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Mostra un alert di conferma prima di eliminare un commento.
   */
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

  /**
   * Elimina un commento dal post.
   */
  async deleteComment(commentId: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Eliminazione commento...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await this.commentService.deleteComment(this.postId, commentId);
      // La lista dei commenti si aggiornerà automaticamente grazie alla sottoscrizione reattiva
      this.presentAppAlert('Commento Eliminato', 'Il commento è stato rimosso.');
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Errore nell\'eliminazione del commento:', error);
      this.presentAppAlert('Errore', 'Impossibile eliminare il commento.');
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Gestisce l'aggiunta o la rimozione di un "Mi piace" a un commento.
   */
  async toggleLikeComment(comment: Comment) {
    if (!this.currentUserId) {
      this.presentAppAlert('Accedi Necessario', 'Devi essere loggato per mostrare il tuo apprezzamento!');
      return;
    }

    const hasLiked = comment.likes.includes(this.currentUserId);
    try {
      await this.commentService.toggleLikeComment(this.postId, comment.id, this.currentUserId, !hasLiked);
      // La lista dei commenti si aggiornerà automaticamente grazie alla sottoscrizione reattiva
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Errore nel toggle like del commento:', error);
      this.presentAppAlert('Errore', 'Impossibile aggiornare il "Mi piace" del commento. Riprova.');
    }
  }

  /**
   * Naviga al profilo dell'utente (proprio o di un altro utente).
   */
  goToUserProfile(userId: string) {
    if (userId === this.currentUserId) {
      this.router.navigateByUrl('/profile');
    } else {
      this.router.navigateByUrl(`/profile/${userId}`);
    }
  }

  /**
   * Formatta il timestamp di un commento in un formato leggibile dall'utente (es. "5 minuti fa").
   */
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

  /**
   * Adatta l'altezza della textarea di input del commento.
   */
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

  /**
   * Presenta un alert personalizzato all'utente.
   */
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

  /**
   * Funzione helper per rimuovere duplicati dall'array di commenti.
   * Utile per prevenire duplicati in scenari di paginazione complessi.
   */
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
