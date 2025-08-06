import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, IonInfiniteScroll } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

// Interfaccia per la struttura di un articolo di notizia
interface NewsItem {
  id: string;
  title: string;
  summary: string;
  imageUrl?: string;
  sourceName: string;
  sourceLogoUrl: string;
  sourceUrl: string;
  timestamp: string;
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

  news: NewsItem[] = [];
  isLoading: boolean = true;
  canLoadMore: boolean = true;

  // Sostituisci con il tuo servizio per le notizie
  private newsServiceSubscription: Subscription | undefined;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router
    // Aggiungi qui il tuo servizio per le notizie (es. private newsService: NewsService)
  ) { }

  ngOnInit() {
    this.loadInitialNews();
  }

  ngOnDestroy(): void {
    if (this.newsServiceSubscription) {
      this.newsServiceSubscription.unsubscribe();
    }
  }

  private loadInitialNews() {
    this.isLoading = true;
    this.news = [];
    this.canLoadMore = true;

    // TODO: Qui dovrai integrare il tuo servizio per recuperare le notizie.
    // Per ora usiamo dati fittizi per mostrare il funzionamento.
    setTimeout(() => {
      this.news = [
        {
          id: '1',
          title: 'Grande novità sul mercato tecnologico',
          summary: 'Un nuovo report indica un boom di vendite per un dispositivo innovativo...',
          imageUrl: 'https://via.placeholder.com/600x400.png?text=Notizia+Tech',
          sourceName: 'Tech News',
          sourceLogoUrl: 'https://via.placeholder.com/100x100.png?text=TN',
          sourceUrl: 'https://tech-news.com/article/1',
          timestamp: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Il futuro dell\'energia sostenibile',
          summary: 'Esperti del settore si confrontano sulle sfide e opportunità...',
          imageUrl: 'https://via.placeholder.com/600x400.png?text=Energia',
          sourceName: 'Global Report',
          sourceLogoUrl: 'https://via.placeholder.com/100x100.png?text=GR',
          sourceUrl: 'https://global-report.com/article/2',
          timestamp: new Date(Date.now() - 3600000).toISOString() // 1 ora fa
        }
      ];
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 2000);
  }

  loadMoreNews(event: Event) {
    const infiniteScrollTarget = event.target as unknown as IonInfiniteScroll;

    // TODO: Implementa la logica per caricare più notizie quando l'utente scorre
    // Questa è solo una simulazione.
    setTimeout(() => {
      const moreNews: NewsItem[] = [
        {
          id: '3',
          title: 'Un nuovo record sportivo è stato infranto',
          summary: 'L\'atleta ha superato ogni aspettativa in una gara mozzafiato...',
          imageUrl: 'https://via.placeholder.com/600x400.png?text=Sport',
          sourceName: 'Sport Daily',
          sourceLogoUrl: 'https://via.placeholder.com/100x100.png?text=SD',
          sourceUrl: 'https://sport-daily.com/article/3',
          timestamp: new Date(Date.now() - 7200000).toISOString() // 2 ore fa
        }
      ];
      this.news = [...this.news, ...moreNews];
      this.canLoadMore = this.news.length < 20; // Esempio di condizione per terminare il caricamento

      infiniteScrollTarget.complete();
      this.cdr.detectChanges();
    }, 1000);
  }

  // Puoi riutilizzare questa funzione per formattare la data della notizia
  formatNewsTime(timestamp: string): string {
    if (!timestamp) return '';

    try {
      const newsDate = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - newsDate.getTime();

      const seconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (seconds < 60) {
        return seconds <= 10 ? 'Adesso' : `${seconds} secondi fa`;
      } else if (minutes < 60) {
        return `${minutes} minuti fa`;
      } else if (hours < 24) {
        return `${hours} ore fa`;
      } else if (days < 7) {
        return `${days} giorni fa`;
      } else {
        return newsDate.toLocaleDateString('it-IT', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    } catch (e) {
      console.error("Errore nel formato data:", timestamp, e);
      return new Date(timestamp).toLocaleDateString('it-IT');
    }
  }

  // Se vuoi reindirizzare l'utente a una pagina interna per i dettagli della notizia
  goToNewsDetails(newsId: string) {
    console.log(`Naviga alla pagina dei dettagli per la notizia con ID: ${newsId}`);
    // Esempio: this.router.navigate(['/notizie', newsId]);
  }
}
