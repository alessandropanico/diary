import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service'; // ⭐ AGGIORNATO QUI ⭐
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';

@Component({
  selector: 'app-search-modal',
  templateUrl: './search-modal.component.html',
  styleUrls: ['./search-modal.component.scss'],
  standalone: false,
})
export class SearchModalComponent implements OnInit, OnDestroy {

  searchQuery: string = '';
  searchResults: UserDashboardCounts[] = []; // ⭐ AGGIORNATO QUI ⭐
  isSearchingUsers: boolean = false;
  searchPerformed: boolean = false;
  loggedInUserId: string | null = null;
  selectedUsers: UserDashboardCounts[] = []; // ⭐ AGGIORNATO QUI ⭐

  private searchTerms = new Subject<string>();
  private searchSubscription: Subscription | undefined;

  constructor(
    private modalCtrl: ModalController,
    private userDataService: UserDataService,
    // private router: Router // Non più necessario se il suo unico scopo era la navigazione chat 1-a-1
  ) { }

  ngOnInit() {
    const auth = getAuth();
    this.loggedInUserId = auth.currentUser ? auth.currentUser.uid : null;
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
          // Assicurati che searchUsers restituisca UserDashboardCounts[]
          const results: UserDashboardCounts[] = await this.userDataService.searchUsers(term); // ⭐ AGGIORNATO QUI ⭐
          this.isSearchingUsers = false;
          // Filtra l'utente attualmente loggato dai risultati della ricerca
          // e filtra anche gli utenti già selezionati
          return results.filter(user =>
            user.uid !== this.loggedInUserId &&
            !this.selectedUsers.some(selected => selected.uid === user.uid)
          );
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

  // Chiamato quando si chiude la modale, con o senza dati
  dismissModal(data?: { selectedUserIds?: string[], groupId?: string, groupName?: string }) {
    this.modalCtrl.dismiss(data);
  }

  onSearchInput(event: any) {
    this.searchQuery = event.target.value;
    this.searchTerms.next(this.searchQuery);
  }

  // Gestisce la selezione/deselezione di un utente
  toggleUserSelection(user: UserDashboardCounts) { // ⭐ AGGIORNATO QUI ⭐
    const index = this.selectedUsers.findIndex(u => u.uid === user.uid);
    if (index > -1) {
      // Selezionato, deseleziona
      this.selectedUsers.splice(index, 1);
    } else {
      // Non selezionato, seleziona
      this.selectedUsers.push(user);
    }
    // Rimuovi l'utente dalla lista dei risultati di ricerca per non selezionarlo due volte
    this.searchResults = this.searchResults.filter(u => u.uid !== user.uid);
  }

  // Rimuove un utente dalla lista dei selezionati (dal chip)
  removeSelectedUser(uid: string) {
    this.selectedUsers = this.selectedUsers.filter(user => user.uid !== uid);
  }

  // Verifica se un utente è selezionato
  isSelected(uid: string): boolean {
    return this.selectedUsers.some(user => user.uid === uid);
  }

  // Crea il gruppo con gli utenti selezionati
  async createGroup() {
    if (this.selectedUsers.length === 0) {
      console.warn('Seleziona almeno un utente per creare un gruppo.');
      return;
    }

    const memberUids = this.selectedUsers.map(user => user.uid);
    this.dismissModal({ selectedUserIds: memberUids });
  }
}
