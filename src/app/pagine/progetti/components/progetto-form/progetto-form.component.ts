import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProgettiService, Project } from 'src/app/services/progetti.service';
import { Subject } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-progetto-form',
  templateUrl: './progetto-form.component.html',
  styleUrls: ['./progetto-form.component.scss'],
  imports: [FormsModule, CommonModule, ReactiveFormsModule]
})
export class ProgettoFormComponent implements OnInit {

  @Input() projectToEdit: Project | undefined;
  @Input() modalController: any; // Inietta il ModalController dal componente padre

  projectForm!: FormGroup;
  title: string = 'Nuovo Progetto';

  constructor(
    private formBuilder: FormBuilder,
    private progettiService: ProgettiService
  ) { }

  ngOnInit() {
    this.title = this.projectToEdit ? 'Modifica Progetto' : 'Nuovo Progetto';
    this.projectForm = this.formBuilder.group({
      name: [this.projectToEdit?.name || '', Validators.required],
      description: [this.projectToEdit?.description || '', Validators.required],
      status: [this.projectToEdit?.status || 'In corso', Validators.required],
      progress: [this.projectToEdit?.progress || 0, [Validators.required, Validators.min(0), Validators.max(100)]],
      dueDate: [this.projectToEdit?.dueDate ? this.formatDate(this.projectToEdit.dueDate) : '']
    });
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
    };

    if (this.projectToEdit && this.projectToEdit.id) {
      await this.progettiService.updateProject(this.projectToEdit.id, projectData);
    } else {
      await this.progettiService.addProject(projectData);
    }

    this.closeModal(projectData, 'confirm');
  }

  closeModal(data: any, role: string) {
    if (this.modalController) {
      this.modalController.dismiss(data, role);
    }
  }
}
