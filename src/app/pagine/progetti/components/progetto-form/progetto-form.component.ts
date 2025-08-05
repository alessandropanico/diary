import { Component, OnInit, Input, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ProgettiService, Project } from 'src/app/services/progetti.service';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
// ⭐ Importa UserDashboardCounts
import { UserDataService, UserProfile, UserDashboardCounts } from 'src/app/services/user-data.service';
import { map } from 'rxjs/operators';

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
  // ⭐ Utilizza il tipo corretto per i risultati e i membri selezionati
  searchResults: UserDashboardCounts[] = [];
  selectedUsers: UserDashboardCounts[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private progettiService: ProgettiService,
    private userDataService: UserDataService
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
        // ⭐ La proprietà 'photo' e 'profilePictureUrl' sono disponibili
        const user = await this.userDataService.getUserDataByUid(memberUid);
        if (user) {
          this.selectedUsers.push({
            uid: memberUid,
            name: user.name,
            nickname: user.nickname,
            profilePictureUrl: user.profilePictureUrl,
            photo: user.photo,
            // Aggiungi altre proprietà necessarie se il tuo servizio le restituisce
          } as UserDashboardCounts);
        }
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

    const projectData: Partial<Project> = {
      ...this.projectForm.value,
      dueDate: this.projectForm.value.dueDate ? new Date(this.projectForm.value.dueDate) : undefined,
      members: this.selectedUsers.map(u => u.uid),
    };

    if (this.projectToEdit && this.projectToEdit.id) {
      await this.progettiService.updateProject(this.projectToEdit.id, projectData);
    } else {
      await this.progettiService.addProject(projectData);
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
