import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-notizia-singola',
  templateUrl: './notizia-singola.page.html',
  styleUrls: ['./notizia-singola.page.scss'],
  standalone: false,
})
export class NotiziaSingolaPage implements OnInit {
  notiziaId: string | null = null;
  notizia: any = null; // Sarà la notizia con la struttura di un Post

  // Dati fittizi per la visualizzazione.
  // In futuro andranno sostituiti con il recupero dati da un servizio.
  mockNotizia = {
    id: '1',
    titolo: 'Nuova scoperta energetica della Shinra!',
    username: 'Shinra Corporation',
    userAvatarUrl: 'assets/immaginiGenerali/shinra-logo.png',
    timestamp: new Date().toISOString(), // Ora attuale
    text: 'La Shinra Corporation ha annunciato un’importante svolta nella produzione di energia Mako. L’amministratore delegato ha dichiarato che questa nuova tecnologia rivoluzionerà il consumo energetico mondiale.',
    immagineUrl: 'https://cdn.pixabay.com/photo/2023/10/26/16/09/bridge-8343118_1280.jpg'
  };

  constructor(private activatedRoute: ActivatedRoute, private router: Router) { }

  ngOnInit() {
    this.notiziaId = this.activatedRoute.snapshot.paramMap.get('id');
    // Simulazione di caricamento della notizia
    // In un'implementazione reale, qui useresti un servizio per recuperare la notizia con l'ID
    if (this.notiziaId === this.mockNotizia.id) {
      this.notizia = this.mockNotizia;
    }
  }

  /**
   * Metodo di utilità per formattare la data, ripreso dal PostComponent.
   * @param timestamp La stringa del timestamp da formattare.
   * @returns La stringa formattata (es. "3 ore fa", "2 giorni fa").
   */
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
      console.error("Errore nel formato data:", timestamp, e);
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
   * Restituisce l'URL della foto profilo, ripreso dal PostComponent.
   * @param photoUrl L'URL della foto profilo dell'utente.
   * @returns L'URL effettivo dell'immagine da visualizzare.
   */
  getUserPhoto(photoUrl: string | null | undefined): string {
    const defaultGoogleProfilePicture = 'https://lh3.googleusercontent.com/a/ACg8ocK-pW1q9zsWi1DHCcamHuNOTLOvotU44G2v2qtMUtWu3LI0FOE=s96-c';
    if (!photoUrl || photoUrl === '' || photoUrl === defaultGoogleProfilePicture) {
      return 'assets/immaginiGenerali/default-avatar.jpg';
    }
    return photoUrl;
  }

  /**
   * Metodo per la navigazione al profilo utente, anche questo ripreso dal PostComponent.
   * @param userId L'ID dell'utente da cui è stato creato il post.
   */
  goToUserProfile(userId: string) {
    // Nota: in un'applicazione reale dovresti confrontare userId con l'id dell'utente corrente
    // Per ora simuliamo la navigazione
    this.router.navigateByUrl(`/profilo/${userId}`);
  }
}
