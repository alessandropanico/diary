import { Component, OnInit, Input, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ProgettiService, Project } from 'src/app/services/progetti.service';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { UserDataService, UserProfile } from 'src/app/services/user-data.service'; // ⭐ Importa UserDataService e UserProfile
import { map } from 'rxjs/operators'; // Importa map se lo userai con gli Observable

@Component({
  selector: 'app-progetto-form',
  templateUrl: './progetto-form.component.html',
  styleUrls: ['./progetto-form.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, IonicModule], // ⭐ Aggiungi FormsModule qui
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProgettoFormComponent implements OnInit {
  @Input() projectToEdit: Project | undefined;
  @Output() modalDismissed = new EventEmitter<{ data: any, role: string }>();

  projectForm!: FormGroup;
  title: string = 'Nuovo Progetto';

  searchTerm: string = '';
  searchResults: any[] = []; // Usiamo 'any[]' per gestire i dati restituiti dal tuo searchUsers
  selectedUsers: any[] = []; // Usiamo 'any[]' per gli utenti selezionati

  constructor(
    private formBuilder: FormBuilder,
    private progettiService: ProgettiService,
    private userDataService: UserDataService // ⭐ Inietta il tuo UserDataService
  ) { }

  async ngOnInit() {
    this.title = this.projectToEdit ? 'Modifica Progetto' : 'Nuovo Progetto';
    this.projectForm = this.formBuilder.group({
      name: [this.projectToEdit?.name || '', Validators.required],
      description: [this.projectToEdit?.description || '', Validators.required],
      status: [this.projectToEdit?.status || 'In corso', Validators.required],
      dueDate: [this.projectToEdit?.dueDate ? this.formatDate(this.projectToEdit.dueDate) : '']
    });

    // Inizializza gli utenti selezionati se stiamo modificando un progetto
    if (this.projectToEdit && this.projectToEdit.members) {
      for (const memberUid of this.projectToEdit.members) {
        // Il tuo getUserDataByUid restituisce una Promise, quindi lo usiamo direttamente
        const user = await this.userDataService.getUserDataByUid(memberUid);
        if (user) {
          this.selectedUsers.push({
            uid: memberUid,
            name: user.name,
            nickname: user.nickname,
            profilePictureUrl: user.profilePictureUrl
          });
        }
      }
    }
  }

  // ⭐ NUOVO METODO: Ricerca utenti
  async searchUsers() {
    if (this.searchTerm.length < 1) {
      this.searchResults = [];
      return;
    }
    // Chiamiamo il metodo searchUsers del tuo servizio
    const results = await this.userDataService.searchUsers(this.searchTerm);
    this.searchResults = results.filter(user =>
      !this.selectedUsers.some(selectedUser => selectedUser.uid === user.uid)
    );
  }

  // ⭐ NUOVO METODO: Seleziona un utente
  selectUser(user: any) {
    if (!this.selectedUsers.some(selectedUser => selectedUser.uid === user.uid)) {
      this.selectedUsers.push(user);
    }
    this.searchTerm = '';
    this.searchResults = [];
  }

  // ⭐ NUOVO METODO: Rimuovi un utente
  removeUser(user: any) {
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
      members: this.selectedUsers.map(u => u.uid), // ⭐ Aggiungi i membri selezionati
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
}
