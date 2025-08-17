import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { Post } from 'src/app/interfaces/post'; // ⭐ AGGIUNGI QUESTO IMPORT ⭐

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

  @Input() isAddingToGroup: boolean = false;
  @Input() isSharingPost: boolean = false;
  @Input() postToShare: Post | null = null; // ⭐ AGGIUNGI QUESTA RIGA ⭐

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


  async toggleUserSelection(user: UserDashboardCounts) {
    if (this.postToShare) {
      // Modalità di condivisione post: chiudi il modale e restituisci l'ID dell'utente.
      await this.modalCtrl.dismiss({ otherParticipantId: user.uid }, 'chatSelected');
      return;
    }

    // Modalità predefinita (creazione di gruppo, ecc.)
    const index = this.selectedUsers.findIndex(u => u.uid === user.uid);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(user);
      this.searchQuery = '';
      this.searchResults = [];
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

  async addMembersToExistingGroup() {
    const memberUids = this.selectedUsers.map(user => user.uid);
    this.dismissModal({ selectedUserIds: memberUids });
  }
}
