import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router'; // Per la navigazione dopo aver selezionato un utente
import { UserDataService } from 'src/app/services/user-data.service'; // Importa il servizio dati utente

import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-search-modal',
  templateUrl: './search-modal.component.html',
  styleUrls: ['./search-modal.component.scss'],
  standalone: false,
})
export class SearchModalComponent implements OnInit, OnDestroy {
  searchQuery: string = '';
  searchResults: any[] = [];
  isSearchingUsers: boolean = false;
  searchPerformed: boolean = false;
  private searchTerms = new Subject<string>();
  private searchSubscription: Subscription | undefined;

  constructor(
    private modalCtrl: ModalController,
    private userDataService: UserDataService,
    private router: Router
  ) { }

  ngOnInit() {
    this.searchSubscription = this.searchTerms.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(async (term: string) => {
        this.isSearchingUsers = true;
        this.searchPerformed = true;
        if (!term.trim()) {
          this.isSearchingUsers = false;
          return [];
        }
        try {
          const results = await this.userDataService.searchUsers(term);
          this.isSearchingUsers = false;
          return results;
        } catch (error) {
          console.error('Errore durante la ricerca utenti:', error);
          this.isSearchingUsers = false;
          return [];
        }
      })
    ).subscribe(results => {
      this.searchResults = results;
    });
  }

  ngOnDestroy() {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  dismissModal() {
    this.modalCtrl.dismiss();
  }

  onSearchInput(event: any) {
    this.searchQuery = event.target.value;
    this.searchTerms.next(this.searchQuery);
  }

  // Metodo chiamato quando un utente viene selezionato dalla lista
  selectUser(uid: string) {
    this.dismissModal(); // Chiudi il modale
    this.router.navigate(['/profilo-altri-utenti', uid]); // Naviga alla pagina del profilo dell'altro utente
  }
}
