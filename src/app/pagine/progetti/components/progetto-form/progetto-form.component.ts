// src/app/components/progetto-form/progetto-form.component.ts

import { Component, OnInit, Input, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ProgettiService, Project } from 'src/app/services/progetti.service';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { UserDataService, UserProfile, UserDashboardCounts } from 'src/app/services/user-data.service';
import { getAuth } from 'firebase/auth';
import { map } from 'rxjs/operators';
import { NotificheService } from 'src/app/services/notifiche.service';

@Component({
  selector: 'app-progetto-form',
  templateUrl: './progetto-form.component.html',
  styleUrls: ['./progetto-form.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, IonicModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProgettoFormComponent implements OnInit {
  @Input() projectToEdit: Project | undefined;
  @Output() modalDismissed = new EventEmitter<{ data: any, role: string }>();

  projectForm!: FormGroup;
  title: string = 'Nuovo Progetto';

  searchTerm: string = '';
  searchResults: UserDashboardCounts[] = [];
  selectedUsers: UserDashboardCounts[] = [];
  private currentUserNickname: string = '';
  // ⭐ NOVITÀ: Aggiunto currentUserId
  private currentUserId: string | null = null;


  constructor(
    private formBuilder: FormBuilder,
    private progettiService: ProgettiService,
    private userDataService: UserDataService,
    private notificheService: NotificheService
  ) { }

  async ngOnInit() {
    this.title = this.projectToEdit ? 'Modifica Progetto' : 'Nuovo Progetto';
    this.projectForm = this.formBuilder.group({
      name: [this.projectToEdit?.name || '', Validators.required],
      description: [this.projectToEdit?.description || '', Validators.required],
      status: [this.projectToEdit?.status || 'In corso', Validators.required],
      dueDate: [this.projectToEdit?.dueDate ? this.formatDate(this.projectToEdit.dueDate) : '']
    });

    if (this.projectToEdit && this.projectToEdit.members) {
      for (const memberUid of this.projectToEdit.members) {
        const user = await this.userDataService.getUserDataByUid(memberUid);
        if (user) {
          this.selectedUsers.push({
            uid: memberUid,
            name: user.name,
            nickname: user.nickname,
            profilePictureUrl: user.profilePictureUrl,
            photo: user.photo,
          } as UserDashboardCounts);
        }
      }
    }
    await this.loadCurrentUserNameAndId();
  }
  // ⭐ AGGIORNATO: Metodo per caricare sia il nickname che l'ID utente
  private async loadCurrentUserNameAndId() {
    const auth = getAuth();
    if (auth.currentUser) {
      this.currentUserId = auth.currentUser.uid;
      const userProfile = await this.userDataService.getUserDataByUid(this.currentUserId);
      if (userProfile) {
        this.currentUserNickname = userProfile.nickname || userProfile.name || 'Utente Sconosciuto';
      }
    }
  }

  async searchUsers() {
    if (this.searchTerm.length < 1) {
      this.searchResults = [];
      return;
    }
    const results = await this.userDataService.searchUsers(this.searchTerm);
    this.searchResults = results.filter(user =>
      !this.selectedUsers.some(selectedUser => selectedUser.uid === user.uid)
    );
  }

  selectUser(user: UserDashboardCounts) {
    if (!this.selectedUsers.some(selectedUser => selectedUser.uid === user.uid)) {
      this.selectedUsers.push(user);
    }
    this.searchTerm = '';
    this.searchResults = [];
  }

  removeUser(user: UserDashboardCounts) {
    this.selectedUsers = this.selectedUsers.filter(u => u.uid !== user.uid);
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
  }

  async saveProject() {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    // ⭐ AGGIORNATO: Controlla che l'ID utente e il nickname siano disponibili
    if (!this.currentUserId || !this.currentUserNickname) {
      console.error('Impossibile salvare il progetto: ID utente o nickname non disponibili.');
      return;
    }

    const projectData: Partial<Project> = {
      ...this.projectForm.value,
      dueDate: this.projectForm.value.dueDate ? new Date(this.projectForm.value.dueDate) : undefined,
      members: this.selectedUsers.map(u => u.uid),
    };

    let projectId: string | undefined;

    if (this.projectToEdit && this.projectToEdit.id) {
      const oldMembers = this.projectToEdit.members || [];
      const newMembers = this.selectedUsers.map(u => u.uid);
      const newlyAddedMembers = newMembers.filter(uid => !oldMembers.includes(uid));

      await this.progettiService.updateProject(this.projectToEdit.id, projectData);
      projectId = this.projectToEdit.id;

      if (projectId && newlyAddedMembers.length > 0) {
        const projectName = projectData.name || 'Progetto';
        for (const memberId of newlyAddedMembers) {
          await this.notificheService.aggiungiNotificaProgetto(
            memberId,
            this.currentUserNickname,
            projectId,
            projectName,
            this.currentUserId
          );
        }
      }
    } else {
      const newProjectId = await this.progettiService.addProject(projectData);
      projectId = newProjectId;

      const newProjectName = projectData.name || 'Progetto';
      const newlyAddedMembers = projectData.members || [];

      if (projectId && newlyAddedMembers.length > 0) {
        for (const memberId of newlyAddedMembers) {
          await this.notificheService.aggiungiNotificaProgetto(
            memberId,
            this.currentUserNickname,
            projectId,
            newProjectName,
            this.currentUserId
          );
        }
      }
    }

    this.modalDismissed.emit({ data: projectData, role: 'confirm' });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.dismiss();
    }
  }

  dismiss() {
    this.modalDismissed.emit({ data: null, role: 'cancel' });
  }

  getAvatarUrl(user: any): string {
    return user.photo || 'assets/immaginiGenerali/default-avatar.jpg';
  }
}
