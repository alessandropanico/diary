import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UserDataService } from 'src/app/services/user-data.service';

@Component({
  selector: 'app-profilo-altri-utenti',
  templateUrl: './profilo-altri-utenti.page.html',
  styleUrls: ['./profilo-altri-utenti.page.scss'],
  standalone: false,
})
export class ProfiloAltriUtentiPage implements OnInit {

  profileData: any = null;
  isLoading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private userDataService: UserDataService
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    this.route.paramMap.subscribe(async params => {
      const userId = params.get('id');

      if (userId) {
        try {
          this.profileData = await this.userDataService.getUserDataById(userId);
          if (!this.profileData) {
            console.warn('Nessun dato trovato per l\'utente con ID:', userId);
          }
        } catch (error) {
          console.error('Errore nel caricamento del profilo utente:', error);
        } finally {
          this.isLoading = false; // Termina il caricamento
        }
      } else {
        console.warn('Nessun ID utente fornito nell\'URL per il profilo esterno.');
        this.isLoading = false;
        // Potresti reindirizzare l'utente o mostrare un messaggio di errore
      }
    });
  }
}
