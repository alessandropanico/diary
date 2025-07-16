// src/app/pagine/list-task/list-task.page.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { TaskService } from 'src/app/services/task.service';
import { Task } from 'src/app/interfaces/task';
import { ModalController, AlertController } from '@ionic/angular';
import { TaskModalComponent } from './components/task-modal/task-modal.component';
import { Subscription } from 'rxjs';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

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
  private authUnsubscribe: (() => void) | undefined; // Per disiscriversi dall'observable di autenticazione

  constructor(
    private taskService: TaskService,
    private modalCtrl: ModalController,
    private alertController: AlertController
  ) { }

async ngOnInit() {
    // Sottoscrivi alla stream di task dal servizio.
    // Questo aggiornerà `this.tasks` ogni volta che il BehaviorSubject nel servizio emette un nuovo valore.
    this.tasksSubscription = this.taskService.tasks$.subscribe(tasks => {
      // Se 'tasks' è null, significa che il caricamento iniziale da Firestore non è ancora completato
      // o che non c'è un utente autenticato e le task sono in uno stato iniziale non definito.
      if (tasks === null) {
        this.isLoadingTasks = true; // Mantieni il loading spinner attivo
        this.tasks = []; // Assicurati che l'array sia vuoto per non visualizzare dati obsoleti
      } else {
        // Se 'tasks' non è null (è un Task[]), allora i dati sono stati caricati (anche se vuoti).
        this.tasks = tasks; // Aggiorna le task visualizzate
        this.isLoadingTasks = false; // Spegni il loading spinner
      }
    });
  }

  ionViewWillEnter() {
    if ((!this.tasks.length && !this.isLoadingTasks) && getAuth().currentUser) {
      this.loadAndProcessTasks();
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


  private async loadAndProcessTasks() {
    this.isLoadingTasks = true;

    try {
      await this.taskService.loadTasks();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tasksToUpdate: Task[] = [];
      this.tasks.forEach(task => {
        if (task.id && !task.completed) {
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate < today) {
            tasksToUpdate.push(task);
          }
        }
      });

      for (const task of tasksToUpdate) {
        try {
          await this.taskService.toggleCompletion(task.id!, true);
        } catch (error) {
          console.error(`Errore durante il marcare la task "${task.name}" scaduta:`, error);
        }
      }

    } catch (error) {
      console.error('Errore nel caricamento o processamento delle task:', error);
      this.tasks = []; // Svuota le task in caso di errore grave
    } finally {
      // this.isLoadingTasks viene impostato a false dalla sottoscrizione a `tasks$`
      // una volta che i dati sono stati emessi.
    }
  }

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
      // Il servizio aggiornerà Firestore e poi emetterà il nuovo array di task,
      // che sarà catturato dalla sottoscrizione in ngOnInit.
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
              // Il servizio aggiornerà Firestore e poi emetterà il nuovo array di task.
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
    if (data && data.refreshTasks) {
    }
  }
}
