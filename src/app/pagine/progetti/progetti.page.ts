import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonList, IonItemSliding } from '@ionic/angular';
import { ProgettiService, Project } from 'src/app/services/progetti.service';
import { Observable } from 'rxjs';

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

  // Variabile per mostrare/nascondere il modale
  showModal: boolean = false;
  // Variabile per passare il progetto da modificare
  projectToEdit: Project | undefined = undefined;

  constructor(
    private router: Router,
    private progettiService: ProgettiService
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

  /**
   * Apre il modale per un nuovo progetto
   */
  createNewProject() {
    this.projectToEdit = undefined;
    this.showModal = true;
  }

  /**
   * Apre il modale per modificare un progetto esistente
   */
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

  /**
   * Gestisce la chiusura del modale e il ricaricamento dei dati.
   * Il metodo viene chiamato quando il componente figlio (il modale)
   * emette l'evento 'modalDismissed'.
   */
  onModalDismiss(event: any) {
    // ⭐ Questa linea è fondamentale per nascondere il modale
    this.showModal = false;

    // Controlla se il modale è stato chiuso con un'azione di 'salvataggio'
    if (event && event.role === 'confirm') {
      this.loadProjects(); // Ricarica i progetti per mostrare i cambiamenti
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
