import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonList, IonItemSliding } from '@ionic/angular';

interface Project {
  id: string;
  name: string;
  status: 'In corso' | 'Completato' | 'In pausa';
  dueDate?: Date;
  progress: number; // Percentuale di completamento
}

@Component({
  selector: 'app-progetti',
  templateUrl: './progetti.page.html',
  styleUrls: ['./progetti.page.scss'],
  standalone: false,
})
export class ProgettiPage implements OnInit {

  @ViewChild(IonList) list!: IonList;
  projects: Project[] = [];
  isLoading: boolean = true;

  constructor(private router: Router) { }

  ngOnInit() {
    this.loadProjects();
  }

  /**
   * Placeholder per la logica di caricamento dei progetti
   * dal database.
   */
  loadProjects() {
    this.isLoading = true;
    // Qui andrà la logica per chiamare un servizio e caricare i dati
    // Simulazione di dati
    setTimeout(() => {
      this.projects = [
        { id: '1', name: 'Ristrutturazione del garage', status: 'In corso', dueDate: new Date('2025-12-31'), progress: 50 },
        { id: '2', name: 'Preparare l\'esame di storia', status: 'In pausa', dueDate: new Date('2025-09-15'), progress: 20 },
        { id: '3', name: 'Creare una nuova app mobile', status: 'Completato', dueDate: new Date('2025-07-20'), progress: 100 },
      ];
      this.isLoading = false;
    }, 1500);
  }

  /**
   * Reindirizza l'utente alla pagina di dettaglio del progetto.
   * @param projectId L'ID del progetto da visualizzare.
   */
  goToProjectDetails(projectId: string) {
    this.router.navigate(['/progetti', projectId]);
  }

  /**
   * Gestisce la creazione di un nuovo progetto.
   */
  createNewProject() {
    console.log('Creare un nuovo progetto');
    // Qui andrà la logica per aprire un modale o navigare a una pagina di creazione
  }

  /**
   * Placeholder per la logica di eliminazione di un progetto.
   * @param projectId L'ID del progetto da eliminare.
   * @param slidingItem L'elemento IonItemSliding per chiuderlo dopo l'eliminazione.
   */
  deleteProject(projectId: string, slidingItem: IonItemSliding) {
    console.log('Eliminare il progetto:', projectId);
    // Qui andrà la logica per eliminare il progetto dal database
    this.projects = this.projects.filter(p => p.id !== projectId);
    slidingItem.close();
  }

  /**
   * Restituisce un colore basato sullo stato del progetto.
   * @param status Lo stato del progetto.
   * @returns Il nome del colore Ionic.
   */
  getStatusColor(status: string): 'primary' | 'success' | 'warning' {
    switch (status) {
      case 'In corso':
        return 'primary';
      case 'Completato':
        return 'success';
      case 'In pausa':
        return 'warning';
      default:
        return 'primary';
    }
  }
}
