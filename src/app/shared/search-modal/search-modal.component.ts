import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
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
  searchResults: UserDashboardCounts[] = [];
  isSearchingUsers: boolean = false;
  searchPerformed: boolean = false;
  loggedInUserId: string | null = null;
  selectedUsers: UserDashboardCounts[] = [];

  private searchTerms = new Subject<string>();
  private searchSubscription: Subscription | undefined;

  constructor(
    private modalCtrl: ModalController,
    private userDataService: UserDataService,
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
          const results: UserDashboardCounts[] = await this.userDataService.searchUsers(term);
          this.isSearchingUsers = false;
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

  dismissModal(data?: { selectedUserIds?: string[], groupId?: string, groupName?: string }) {
    this.modalCtrl.dismiss(data);
  }

  onSearchInput(event: any) {
    this.searchQuery = event.target.value;
    this.searchTerms.next(this.searchQuery);
  }

  toggleUserSelection(user: UserDashboardCounts) {
    const index = this.selectedUsers.findIndex(u => u.uid === user.uid);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(user);
      // ⭐ Queste righe sono corrette e dovrebbero svuotare il campo ⭐
      this.searchQuery = '';
      this.searchResults = [];
      // ⭐ Importante: assicurati che il Subject sia notificato anche con una stringa vuota ⭐
      // Questo farà sì che il switchMap emetta un array vuoto e pulisca i suggerimenti
      this.searchTerms.next('');
    }
  }

  removeSelectedUser(uid: string) {
    this.selectedUsers = this.selectedUsers.filter(user => user.uid !== uid);
  }

  isSelected(uid: string): boolean {
    return this.selectedUsers.some(user => user.uid === uid);
  }

  async createGroup() {
    if (this.selectedUsers.length === 0) {
      console.warn('Seleziona almeno un utente per creare un gruppo.');
      return;
    }

    const memberUids = this.selectedUsers.map(user => user.uid);
    if (this.loggedInUserId && !memberUids.includes(this.loggedInUserId)) {
      memberUids.push(this.loggedInUserId);
    }
    this.dismissModal({ selectedUserIds: memberUids });
  }
}
