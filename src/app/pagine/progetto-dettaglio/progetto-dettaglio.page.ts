import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProgettiService, Project } from 'src/app/services/progetti.service';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
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

  showEditModal: boolean = false;
  projectToEdit: Project | undefined = undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private progettiService: ProgettiService,
    private alertController: AlertController,
    private toastController: ToastController
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
    this.progettiService.getProjectById(id).subscribe({
      next: (projectData) => {
        this.project = projectData;
        this.isLoading = false;
      },
      error: (err) => {
        console.error("Errore nel caricamento del progetto:", err);
        this.isLoading = false;
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
    if (this.project) {
      this.projectToEdit = this.project;
      this.showEditModal = true;
    }
  }

  onModalDismiss(event: any) {
    this.showEditModal = false;
    if (event && event.role === 'confirm' && this.projectId) {
      this.loadProjectDetails(this.projectId);
      this.presentToast('Progetto aggiornato con successo!');
    }
  }

  async deleteProject() {
    const alert = await this.alertController.create({
      header: 'Conferma',
      message: 'Sei sicuro di voler eliminare questo progetto?',
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Elimina',
          handler: () => {
            if (this.projectId) {
              this.progettiService.deleteProject(this.projectId).then(() => {
                this.presentToast('Progetto eliminato.');
                this.router.navigate(['/progetti']);
              }).catch(err => {
                console.error('Errore durante l\'eliminazione:', err);
                this.presentToast('Errore durante l\'eliminazione del progetto.');
              });
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }
}
