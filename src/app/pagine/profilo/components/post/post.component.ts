// ... (le tue importazioni esistenti) ...
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService } from 'src/app/services/post.service';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Post } from 'src/app/interfaces/post'; // Assicurati che Post sia importato
import { Subscription, from } from 'rxjs';
import { getAuth } from 'firebase/auth';
import { Router } from '@angular/router';
import { AlertController, LoadingController, Platform, IonInfiniteScroll, IonicModule } from '@ionic/angular';
import { ExpService } from 'src/app/services/exp.service';
import { CommentsModalComponent } from '../comments-modal/comments-modal.component';

@Component({
  selector: 'app-post',
  templateUrl: './post.component.html',
  styleUrls: ['./post.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CommentsModalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostComponent implements OnInit, OnDestroy {
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  posts: Post[] = [];
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
  // --- NUOVA PROPRIETÀ: Per memorizzare l'intero oggetto post selezionato ---
  selectedPostForComments: Post | null = null;


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
    private platform: Platform,
    private expService: ExpService
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
            this.loadInitialPosts();
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

  loadInitialPosts() {
    this.isLoadingPosts = true;
    this.postsSubscription?.unsubscribe();
    this.lastPostTimestamp = null;
    this.canLoadMore = true;

    this.showCommentsModal = false;
    this.selectedPostIdForComments = null;
    this.selectedPostForComments = null; // Resetta anche l'oggetto post selezionato

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
      this.infiniteScroll.complete();
    }

    this.postsSubscription = this.postService.getPosts(this.postsLimit, this.lastPostTimestamp).subscribe({
      next: (postsData) => {
        this.posts = postsData;
        this.isLoadingPosts = false;
        if (this.posts.length > 0) {
          this.lastPostTimestamp = this.posts[this.posts.length - 1].timestamp;
        }
        if (postsData.length < this.postsLimit) {
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

  async loadMorePosts(event: any) {
    if (!this.canLoadMore) {
      event.target.complete();
      return;
    }

    try {
      this.postsSubscription = this.postService.getPosts(this.postsLimit, this.lastPostTimestamp).subscribe({
        next: (newPosts) => {
          this.posts = [...this.posts, ...newPosts];
          if (newPosts.length > 0) {
            this.lastPostTimestamp = this.posts[this.posts.length - 1].timestamp;
          }

          if (newPosts.length < this.postsLimit) {
            this.canLoadMore = false;
            if (this.infiniteScroll) {
              this.infiniteScroll.disabled = true;
            }
          }
          this.cdr.detectChanges();
          event.target.complete();
        },
        error: (error) => {
          console.error('Errore nel caricamento di altri post:', error);
          this.presentAppAlert('Errore di caricamento', 'Impossibile caricare altri post. Riprova.');
          this.canLoadMore = false;
          if (this.infiniteScroll) {
            this.infiniteScroll.disabled = true;
          }
          this.cdr.detectChanges();
          event.target.complete();
        }
      });
    } catch (error) {
      console.error('Errore generico in loadMorePosts:', error);
      this.canLoadMore = false;
      if (this.infiniteScroll) {
        this.infiniteScroll.disabled = true;
      }
      event.target.complete();
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
      await this.postService.createPost(newPost);
      this.newPostText = '';
      const textarea = document.querySelector('.app-textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
      }
      this.presentAppAlert('Successo', 'Il tuo messaggio è stato pubblicato con successo nell\'etere!');
      this.expService.addExperience(50, 'postCreated');
      this.loadInitialPosts();
    } catch (error) {
      console.error('Errore nella creazione del post:', error);
      this.presentAppAlert('Errore di pubblicazione', 'Impossibile pubblicare il post. Riprova più tardi.');
    } finally {
      await loading.dismiss();
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

  async toggleLike(post: Post) {
    if (!this.currentUserId) {
      this.presentAppAlert('Accedi Necessario', 'Devi essere loggato per mostrare il tuo apprezzamento!');
      return;
    }

    const hasLiked = post.likes.includes(this.currentUserId);
    try {
      await this.postService.toggleLike(post.id, this.currentUserId, !hasLiked);
      if (!hasLiked) {
        post.likes = [...post.likes, this.currentUserId];
      } else {
        post.likes = post.likes.filter(id => id !== this.currentUserId);
      }
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Errore nel toggle like:', error);
      this.presentAppAlert('Errore', 'Impossibile aggiornare il "Mi piace". Riprova.');
    }
  }

  // --- MODIFICATO: Questa funzione ora cerca e memorizza l'intero oggetto post ---
  toggleCommentsVisibility(postId: string) {
    this.selectedPostIdForComments = postId;
    // Trova il post completo e memorizzalo
    this.selectedPostForComments = this.posts.find(p => p.id === postId) || null;
    this.showCommentsModal = true;
    this.cdr.detectChanges();
  }

  closeCommentsModal(): void {
    this.showCommentsModal = false;
    this.selectedPostIdForComments = null;
    this.selectedPostForComments = null; // Resetta anche l'oggetto post selezionato alla chiusura
    this.cdr.detectChanges();
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
}
