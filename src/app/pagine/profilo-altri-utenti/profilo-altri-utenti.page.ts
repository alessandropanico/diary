// src/app/pagine/profilo-altri-utenti/profilo-altri-utenti.page.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router'; // Importa ActivatedRoute
import { UserDataService } from 'src/app/services/user-data.service'; // Importa il tuo UserDataService

@Component({
  selector: 'app-profilo-altri-utenti',
  templateUrl: './profilo-altri-utenti.page.html',
  styleUrls: ['./profilo-altri-utenti.page.scss'],
  standalone: false,
})
export class ProfiloAltriUtentiPage implements OnInit {

  profileData: any = null; // Questa variabile conterrà i dati del profilo caricati
  isLoading: boolean = true; // Per mostrare un caricamento

  constructor(
    private route: ActivatedRoute, // Inietta ActivatedRoute per leggere i parametri dell'URL
    private userDataService: UserDataService // Inietta il tuo servizio per i dati utente
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    this.route.paramMap.subscribe(async params => {
      // 'id' deve corrispondere al nome del parametro che hai definito nel routing (:id)
      const userId = params.get('id');

      if (userId) {
        console.log('Caricamento profilo per ID utente:', userId);
        try {
          // Chiama il metodo getUserDataById dal tuo UserDataService
          this.profileData = await this.userDataService.getUserDataById(userId);
          if (!this.profileData) {
            console.warn('Nessun dato trovato per l\'utente con ID:', userId);
            // Potresti mostrare un messaggio all'utente o reindirizzarlo
          }
        } catch (error) {
          console.error('Errore nel caricamento del profilo utente:', error);
          // Gestisci l'errore, ad esempio mostrando un alert
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
