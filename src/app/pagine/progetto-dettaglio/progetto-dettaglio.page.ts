import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProgettiService, Project } from 'src/app/services/progetti.service';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Observable } from 'rxjs';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private progettiService: ProgettiService
  ) { }

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id');
    if (this.projectId) {
      this.loadProjectDetails(this.projectId);
    } else {
      this.router.navigate(['/progetti']);
    }
  }

  loadProjectDetails(id: string) {
    this.isLoading = true;

    // ⭐ Adesso utilizziamo il servizio per recuperare il progetto dal database
    this.progettiService.getProjectById(id).subscribe({
      next: (projectData) => {
        this.project = projectData;
        this.isLoading = false;
      },
      error: (err) => {
        console.error("Errore nel caricamento del progetto:", err);
        this.isLoading = false;
        // Opzionale: reindirizzare o mostrare un errore
      }
    });
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
