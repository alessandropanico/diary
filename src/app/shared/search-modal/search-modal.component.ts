// src/app/modals/search-modal/search-modal.component.ts

import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
import { GroupChat, GroupChatService } from 'src/app/services/group-chat.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { Post } from 'src/app/interfaces/post';

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
  selectedGroups: GroupChat[] = [];
  userGroups: GroupChat[] = [];

  private searchTerms = new Subject<string>();
  private searchSubscription: Subscription | undefined;
  private groupsSubscription: Subscription | undefined;

  @Input() isAddingToGroup: boolean = false;
  @Input() isSharingPost: boolean = false;
  @Input() postToShare: Post | null = null;

  constructor(
    private modalCtrl: ModalController,
    private userDataService: UserDataService,
    private groupChatService: GroupChatService
  ) { }

  ngOnInit() {
    const auth = getAuth();
    this.loggedInUserId = auth.currentUser ? auth.currentUser.uid : null;

    // Carica la lista dei gruppi dell'utente loggato
    if (this.loggedInUserId && this.isSharingPost) {
      this.groupsSubscription = this.groupChatService.getGroupsForUser(this.loggedInUserId).subscribe(groups => {
        this.userGroups = groups;
      });
    }

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
    if (this.groupsSubscription) {
      this.groupsSubscription.unsubscribe();
    }
  }

  dismissModal(data?: { selectedUserIds?: string[], selectedGroupIds?: string[], groupId?: string, groupName?: string }) {
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
    }
  }

  toggleGroupSelection(group: GroupChat) {
    const index = this.selectedGroups.findIndex(g => g.groupId === group.groupId);
    if (index > -1) {
      this.selectedGroups.splice(index, 1);
    } else {
      this.selectedGroups.push(group);
    }
  }

  async confirmSelection() {
    const selectedUserIds = this.selectedUsers.map(user => user.uid);
    const selectedGroupIds = this.selectedGroups.map(group => group.groupId);
    await this.modalCtrl.dismiss({ selectedUserIds: selectedUserIds, selectedGroupIds: selectedGroupIds }, 'chatSelected');
  }

  removeSelectedUser(uid: string) {
    this.selectedUsers = this.selectedUsers.filter(user => user.uid !== uid);
  }

  removeSelectedGroup(groupId: string) {
    this.selectedGroups = this.selectedGroups.filter(group => group.groupId !== groupId);
  }

  isSelected(uid: string): boolean {
    return this.selectedUsers.some(user => user.uid === uid);
  }

  isGroupSelected(groupId: string): boolean {
    return this.selectedGroups.some(group => group.groupId === groupId);
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
