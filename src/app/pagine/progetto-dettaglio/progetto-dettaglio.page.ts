import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'In corso' | 'Completato' | 'In pausa';
  dueDate?: Date;
  progress: number;
  tasks: string[]; // Lista di task associati
}

@Component({
  selector: 'app-progetto-dettaglio',
  templateUrl: './progetto-dettaglio.page.html',
  styleUrls: ['./progetto-dettaglio.page.scss'],
  standalone: false,
})
export class ProgettoDettaglioPage implements OnInit {

  project: Project | undefined;
  isLoading: boolean = true;
  projectId: string | null = null;

  // Dati di esempio (placeholder)
  private mockProjects: Project[] = [
    { id: '1', name: 'Ristrutturazione del garage', description: 'Organizzare e completare tutti i lavori di ristrutturazione interna ed esterna del garage entro la fine dell\'anno.', status: 'In corso', dueDate: new Date('2025-12-31'), progress: 50, tasks: ['Comprare materiali', 'Rimuovere vecchi attrezzi', 'Dipingere le pareti', 'Installare nuova illuminazione'] },
    { id: '2', name: 'Preparare l\'esame di storia', description: 'Studiare e ripassare tutti gli argomenti del programma per l\'esame finale.', status: 'In pausa', dueDate: new Date('2025-09-15'), progress: 20, tasks: ['Leggere il libro 1', 'Creare schemi riassuntivi', 'Esercitarsi con i test'] },
    { id: '3', name: 'Creare una nuova app mobile', description: 'Sviluppare un\'applicazione mobile completa, dal design alla pubblicazione.', status: 'Completato', dueDate: new Date('2025-07-20'), progress: 100, tasks: ['Definire il concept', 'Sviluppare il frontend', 'Creare il backend', 'Pubblicare l\'app'] },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id');
    if (this.projectId) {
      this.loadProjectDetails(this.projectId);
    } else {
      // Reindirizza o mostra un messaggio di errore se l'ID non è presente
      this.router.navigate(['/progetti']);
    }
  }

  loadProjectDetails(id: string) {
    this.isLoading = true;
    setTimeout(() => {
      this.project = this.mockProjects.find(p => p.id === id);
      this.isLoading = false;
    }, 500);
  }

  getStatusColor(status: string): 'primary' | 'success' | 'warning' {
    switch (status) {
      case 'In corso': return 'primary';
      case 'Completato': return 'success';
      case 'In pausa': return 'warning';
      default: return 'primary';
    }
  }

  editProject() {
    console.log('Modifica del progetto');
    // Qui andrà la logica per la modifica del progetto
  }

  deleteProject() {
    console.log('Eliminazione del progetto');
    // Qui andrà la logica per l'eliminazione del progetto
  }
}
