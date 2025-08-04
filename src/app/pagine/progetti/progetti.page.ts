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

  createNewProject() {
    this.router.navigate(['/progetti/new']);
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
