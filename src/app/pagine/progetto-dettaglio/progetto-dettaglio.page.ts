import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProgettiService, Project } from 'src/app/services/progetti.service';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { UserDataService, UserDashboardCounts } from 'src/app/services/user-data.service';
// ⭐ Importa il servizio Auth
import { Auth } from '@angular/fire/auth';

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
  projectMembers: UserDashboardCounts[] = [];

  showEditModal: boolean = false;
  projectToEdit: Project | undefined = undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private progettiService: ProgettiService,
    private alertController: AlertController,
    private toastController: ToastController,
    private userDataService: UserDataService,
    private auth: Auth // ⭐ Inietta Auth per l'utente corrente
  ) { }

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id');
    if (this.projectId) {
      this.loadProjectDetails(this.projectId);
    } else {
      this.router.navigate(['/progetti']);
    }
  }

  async loadProjectDetails(id: string) {
    this.isLoading = true;
    this.progettiService.getProjectById(id).subscribe({
      next: async (projectData) => {
        this.project = projectData;
        this.isLoading = false;

        if (this.project?.members && this.project.members.length > 0) {
          await this.loadProjectMembers(this.project.members);
        } else {
          this.projectMembers = [];
        }
      },
      error: (err) => {
        console.error("Errore nel caricamento del progetto:", err);
        this.isLoading = false;
      }
    });
  }

  // ⭐ Metodo corretto per caricare i dettagli dei membri
  async loadProjectMembers(memberUids: string[]) {
    this.projectMembers = [];
    for (const uid of memberUids) {
      const user = await this.userDataService.getUserDataByUid(uid);
      if (user) {
        // ⭐ Crea un nuovo oggetto unendo i dati dell'utente con il suo UID ⭐
        const memberWithUid = {
          ...user, // Copia tutte le proprietà dell'oggetto utente
          uid: uid  // Aggiungi esplicitamente la proprietà uid
        };
        this.projectMembers.push(memberWithUid as UserDashboardCounts);
      }
    }
  }

  // ⭐ Aggiungi un controllo per sicurezza anche in goToProfile ⭐
  goToProfile(memberUid: string) {
    const currentUserUid = this.auth.currentUser?.uid;

    // ⭐ Controlla che memberUid esista prima di navigare ⭐
    if (!memberUid) {
      console.error('ID utente mancante per la navigazione al profilo.');
      return; // Interrompe la navigazione
    }

    if (currentUserUid && currentUserUid === memberUid) {
      this.router.navigate(['/profilo']);
    } else {
      this.router.navigate(['/profilo-altri-utenti', memberUid]);
    }
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
