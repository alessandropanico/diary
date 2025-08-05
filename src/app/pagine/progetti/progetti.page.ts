import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonList, IonItemSliding } from '@ionic/angular';
import { ProgettiService, Project } from 'src/app/services/progetti.service';
import { Observable } from 'rxjs';
// ⭐ Importa ExpService
import { ExpService } from 'src/app/services/exp.service';

@Component({
  selector: 'app-progetti',
  templateUrl: './progetti.page.html',
  styleUrls: ['./progetti.page.scss'],
  standalone: false,
})
export class ProgettiPage implements OnInit {
  @ViewChild(IonList) list!: IonList;
  projects$!: Observable<Project[]>;
  isLoading: boolean = true;
  showModal: boolean = false;
  projectToEdit: Project | undefined = undefined;

  constructor(
    private router: Router,
    private progettiService: ProgettiService,
    private expService: ExpService // ⭐ Inietta ExpService
  ) { }

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.isLoading = true;
    this.projects$ = this.progettiService.getProjects();

    this.projects$.subscribe({
      next: () => this.isLoading = false,
      error: (err) => {
        console.error("Errore nel caricamento dei progetti:", err);
        this.isLoading = false;
      }
    });
  }

  goToProjectDetails(projectId: string | undefined) {
    if (projectId) {
      this.router.navigate(['/progetti', projectId]);
    }
  }

  createNewProject() {
    this.projectToEdit = undefined;
    this.showModal = true;
  }

  editProject(project: Project, slidingItem: IonItemSliding) {
    slidingItem.close();
    this.projectToEdit = project;
    this.showModal = true;
  }

  deleteProject(projectId: string | undefined, slidingItem: IonItemSliding) {
    if (projectId) {
      this.progettiService.deleteProject(projectId).then(() => {
        slidingItem.close();
      }).catch(err => {
        console.error('Errore durante l\'eliminazione del progetto:', err);
      });
    }
  }

  async onModalDismiss(event: any) {
    this.showModal = false;

    if (event && event.role === 'confirm') {
      // ⭐ Se projectToEdit era undefined, significa che è un NUOVO progetto
      if (!this.projectToEdit) {
        const xpAmount = 50; // ⭐ Definisci i punti esperienza da assegnare
        await this.expService.addExperience(xpAmount, 'Progetto creato');
        console.log(`XP assegnati per la creazione di un nuovo progetto: +${xpAmount}`);
      }

      this.loadProjects();
    }
  }

  getStatusColor(status: string): 'primary' | 'success' | 'warning' | 'danger' {
    switch (status) {
      case 'In corso': return 'primary';
      case 'Completato': return 'success';
      case 'In pausa': return 'warning';
      case 'Archiviato': return 'danger';
      default: return 'primary';
    }
  }
}
