// src/app/list-task/list-task.page.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { TaskService } from 'src/app/services/task.service';
import { Task } from 'src/app/interfaces/task'; // Assicurati che l'interfaccia Task abbia 'id?: string;'
import { ModalController, AlertController } from '@ionic/angular'; // Aggiungi AlertController
import { TaskModalComponent } from './components/task-modal/task-modal.component';
import { Subscription } from 'rxjs'; // Per gestire la sottoscrizione
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Per gestire l'autenticazione

@Component({
  selector: 'app-list-task',
  templateUrl: './list-task.page.html',
  styleUrls: ['./list-task.page.scss'],
  standalone: false,
})
export class ListTaskPage implements OnInit, OnDestroy {
  tasks: Task[] = [];
  isLoadingTasks = true; // Nuovo stato per indicare il caricamento delle task
  private tasksSubscription!: Subscription; // Per gestire la sottoscrizione all'observable

  constructor(
    private taskService: TaskService,
    private modalCtrl: ModalController,
    private alertController: AlertController // Iniettiamo AlertController
  ) { }

  async ngOnInit() {
    this.isLoadingTasks = true; // Inizia lo stato di caricamento

    // Sottoscriviti all'observable delle task per ricevere gli aggiornamenti dal TaskService
    this.tasksSubscription = this.taskService.tasks$.subscribe(tasks => {
      // Quando le task cambiano nel servizio, aggiorna l'array locale
      this.tasks = tasks;
      this.isLoadingTasks = false; // Le task sono state caricate (anche se l'array è vuoto)

      // Puoi riattivare la logica di "flagging" delle task scadute qui,
      // ma considera che ogni chiamata a toggleCompletion ora è un'operazione Firestore asincrona.
      // Esempio (se vuoi che sia automatico):
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      tasks.forEach(async task => { // Usa async/await nel forEach
        if (task.id && !task.completed) {
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate < today) {
            // Effettua il toggle solo se la task non è già stata completata
            if (!task.completed) {
              console.log(`Task '${task.name}' scaduta e non completata. La marco come completata.`);
              await this.taskService.toggleCompletion(task.id, true);
            }
          }
        }
      });
    });

    // Ascolta i cambiamenti nello stato di autenticazione Firebase
    // Questo assicura che le task vengano caricate solo quando l'utente è loggato
    onAuthStateChanged(getAuth(), async (user) => {
      if (user) {
        console.log(`ListTaskPage: Utente Firebase disponibile. UID: ${user.uid}`);
        await this.taskService.loadTasks(); // Carica le task dall'utente corrente
      } else {
        console.warn("ListTaskPage: Nessun utente loggato. Task non caricate.");
        this.tasks = []; // Svuota l'array delle task se l'utente è disconnesso
        this.isLoadingTasks = false;
      }
    });
  }

  // Assicurati di fare l'unsubscribe per prevenire memory leaks
  ngOnDestroy() {
    if (this.tasksSubscription) {
      this.tasksSubscription.unsubscribe();
    }
  }

  formatDateIT(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // i mesi partono da 0
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Funzione per cambiare lo stato di completamento della task
  // Ora riceve l'intera task (che contiene l'ID)
  async toggleCompletion(task: Task) {
    if (!task.id) {
      console.error('Impossibile aggiornare la task: ID non trovato.', task);
      return;
    }
    try {
      // Inverti lo stato di completamento e chiamalo in modo asincrono
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

  // Funzione per eliminare una task
  // Ora riceve l'intera task (che contiene l'ID)
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
              await this.taskService.deleteTask(task.id!); // Chiamata asincrona
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

    // Ascolta quando la modale viene chiusa
    const { data } = await modal.onDidDismiss();
    // Se la modale ha segnalato di voler un refresh delle task
    if (data && data.refreshTasks) {
      await this.taskService.loadTasks(); // Ricarica le task per mostrare quelle appena aggiunte
    }
  }
}
