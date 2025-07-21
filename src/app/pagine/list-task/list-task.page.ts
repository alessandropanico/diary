import { Component, OnInit, OnDestroy } from '@angular/core';
import { TaskService } from 'src/app/services/task.service';
import { Task } from 'src/app/interfaces/task';
import { ModalController, AlertController } from '@ionic/angular';
import { TaskModalComponent } from './components/task-modal/task-modal.component';
import { Subscription } from 'rxjs';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

// --- NUOVA INTERFACCIA PER LE DATE EVIDENZIATE (puoi spostarla in un file globale se la usi spesso) ---
interface HighlightedDate {
  date: string; // Formato 'YYYY-MM-DD'
  textColor?: string;
  backgroundColor?: string;
}
// --- FINE NUOVA INTERFACCIA ---

@Component({
  selector: 'app-list-task',
  templateUrl: './list-task.page.html',
  styleUrls: ['./list-task.page.scss'],
  standalone: false,
})
export class ListTaskPage implements OnInit, OnDestroy {
  tasks: Task[] = [];
  isLoadingTasks = true;
  private tasksSubscription: Subscription | undefined;
  private authUnsubscribe: (() => void) | undefined;

  // ⭐ PROPRIETÀ NECESSARIE PER IL CALENDARIO (COME NEL DIARIO)
  todayString: string = this.formatDate(new Date()); // Formato YYYY-MM-DD
  selectedCalendarDate: string = new Date().toISOString(); // Usato da ngModel
  highlightedDatesConfig: HighlightedDate[] = []; // Per le date evidenziate
  // ⭐ FINE PROPRIETÀ CALENDARIO

  constructor(
    private taskService: TaskService,
    private modalCtrl: ModalController,
    private alertController: AlertController
  ) { }

  async ngOnInit() {
    // Sottoscrizione per ricevere gli aggiornamenti delle task
    this.tasksSubscription = this.taskService.tasks$.subscribe(tasks => {
      if (tasks === null) {
        this.isLoadingTasks = true;
        this.tasks = [];
        this.highlightedDatesConfig = []; // Resetta highlights se le task sono null
      } else {
        this.tasks = tasks;
        this.isLoadingTasks = false;
        this.updateHighlightedDates(); // Aggiorna le date evidenziate quando le task cambiano
      }
    });

    // Gestione dello stato di autenticazione per caricare le task
    this.authUnsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      if (user) {
        // Se l'utente è loggato, il TaskService si occupa di caricare/processare e il subscribe aggiornerà
        // Non è necessario chiamare loadAndProcessTasks qui se il servizio lo fa al cambio di stato utente.
        // Se il tuo TaskService NON carica automaticamente al login, potresti volerlo fare qui:
        // await this.taskService.loadTasks();
      } else {
        this.isLoadingTasks = false;
        this.tasks = [];
        this.highlightedDatesConfig = []; // Pulisci se l'utente si disconnette
      }
    });
  }

  ionViewWillEnter() {
    // Questa logica si occupa di caricare le task se la pagina viene ri-visitata
    // e non ci sono task caricate (es. dopo il login o se si torna dalla pagina di dettaglio)
    if (!this.tasks.length && !this.isLoadingTasks && getAuth().currentUser) {
      // Chiamiamo il metodo del servizio per processare le task scadute
      // Questo invocherà loadTasks() e poi processExpiredTasks()
      this.taskService.loadTasks(); // Questo dovrebbe attivare il subscribe e aggiornare la UI
    }
  }

  ngOnDestroy() {
    if (this.tasksSubscription) {
      this.tasksSubscription.unsubscribe();
    }
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }
  }

  // ⭐ AGGIORNA LE DATE EVIDENZIATE BASATE SULLE TUE TASK
  private updateHighlightedDates() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.highlightedDatesConfig = this.tasks
      .filter(task => !task.completed && new Date(task.dueDate).setHours(0, 0, 0, 0) >= today.getTime()) // Solo task non completate e non scadute
      .map(task => ({
        date: this.formatDate(new Date(task.dueDate)), // Usa formatDate per il formato YYYY-MM-DD
        textColor: '#000000', // Testo nero per le date evidenziate
        backgroundColor: '#00ffee', // Il tuo colore ciano/verde FF7
      }));
  }

  // ⭐ METODO CHIAMATO QUANDO LA DATA NEL CALENDARIO CAMBIA
  onCalendarDateChange(event: CustomEvent) {
    this.selectedCalendarDate = event.detail.value;
    console.log('Data selezionata nel calendario task:', this.formatDateIT(this.selectedCalendarDate));
    // Qui potresti voler filtrare le task in base alla data selezionata
    // Ad esempio: this.filterTasksByDate(this.selectedCalendarDate);
  }

  // ⭐ Metodo per formattare una data in YYYY-MM-DD (necessario per max e highlightedDates)
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ⭐ Il tuo metodo esistente per formattare la data per la visualizzazione IT
  formatDateIT(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  async toggleCompletion(task: Task) {
    if (!task.id) {
      console.error('Impossibile aggiornare la task: ID non trovato.', task);
      return;
    }
    try {
      await this.taskService.toggleCompletion(task.id, !task.completed);
    } catch (error) {
      console.error('Errore durante il cambio stato della task:', error);
      const errorAlert = await this.alertController.create({
        header: 'Errore',
        message: 'Impossibile aggiornare lo stato della task. Riprova.',
        buttons: ['OK'],
      });
      await errorAlert.present();
    }
  }

  async deleteTask(task: Task) {
    if (!task.id) {
      console.error('Impossibile eliminare la task: ID non trovato.', task);
      return;
    }

    const alert = await this.alertController.create({
      header: 'Conferma eliminazione',
      message: `Sei sicuro di voler eliminare la task "${task.name}"?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina',
          handler: async () => {
            try {
              await this.taskService.deleteTask(task.id!);
            } catch (error) {
              console.error('Errore durante l\'eliminazione della task:', error);
              const errorAlert = await this.alertController.create({
                header: 'Errore',
                message: 'Impossibile eliminare la task. Riprova.',
                buttons: ['OK'],
              });
              await errorAlert.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async openTaskModal() {
    const modal = await this.modalCtrl.create({
      component: TaskModalComponent,
      cssClass: 'ff7-modal-glow'
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    // Non è più necessario chiamare loadAndProcessTasks qui,
    // la subscription a tasks$ in ngOnInit dovrebbe già aggiornare la lista.
  }
}
