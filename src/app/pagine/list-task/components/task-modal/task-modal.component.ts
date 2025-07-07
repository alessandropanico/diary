// src/app/task-modal/task-modal.component.ts

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { TaskService } from 'src/app/services/task.service';
import { Task } from 'src/app/interfaces/task'; // Importa l'interfaccia Task

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './task-modal.component.html',
  styleUrls: ['./task-modal.component.scss'],
})
export class TaskModalComponent {
  // Inizializza newTask con i campi dell'interfaccia Task
  newTask: Task = {
    name: '',
    description: '',
    createdAt: new Date().toISOString(), // Data di creazione predefinita
    dueDate: '',
    completed: false,
  };

  minDate: string = '';
  messageSuccess = '';

  constructor(
    private taskService: TaskService,
    private modalCtrl: ModalController,
    private alertController: AlertController
  ) {
    this.setMinDate();
  }

  setMinDate() {
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0]; // Formato YYYY-MM-DD per ion-datetime
  }

  async addTask() {
    // Convalida la data di scadenza
    const dueDate = new Date(this.newTask.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Azzera ore, minuti, secondi per un confronto corretto
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today) {
      const alert = await this.alertController.create({
        header: 'Data non valida',
        message: 'Non puoi inserire una task con data nel passato.',
        buttons: ['OK'],
      });
      return await alert.present();
    }

    // Controlla che i campi obbligatori siano presenti
    if (this.newTask.name.trim() && this.newTask.dueDate) {
      try {
        // Chiama addTask in modo asincrono
        await this.taskService.addTask(this.newTask);
        this.messageSuccess = 'Task aggiunta con successo!';

        // Per nascondere la tastiera su mobile, se l'elemento attivo è un input/textarea
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        // Mostra l'alert di gaming e poi chiudi la modale
        await this.showGamingAlert();
        // Passa un flag per indicare al componente chiamante di ricaricare le task
        await this.modalCtrl.dismiss({ dismissed: true, refreshTasks: true });

      } catch (error) {
        console.error('Errore durante l\'aggiunta della task:', error);
        // Mostra un alert all'utente in caso di errore
        let errorMessage = 'Impossibile aggiungere la task. Riprova.';
        if (error instanceof Error && error.message === 'Unauthorized') {
          errorMessage = 'Devi essere loggato per aggiungere una task.';
        }
        const errorAlert = await this.alertController.create({
          header: 'Errore',
          message: errorMessage,
          buttons: ['OK'],
        });
        await errorAlert.present();
      }
    }
  }

  async showGamingAlert(): Promise<void> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'TASK AGGIUNTA!',
        message: `Obiettivo impostato con successo!`,
        cssClass: ['gaming-alert', 'alert-dark-force'],
        buttons: [
          {
            text: 'Avanti!',
            role: 'cancel',
            cssClass: 'alert-continue',
            handler: () => {
              resolve();
            }
          },
        ],
        backdropDismiss: false,
        mode: 'ios',
      });

      await alert.present();
    });
  }

  // Aggiungiamo un flag per sapere se ricaricare le task nella pagina chiamante
  close() {
    this.modalCtrl.dismiss({ dismissed: true, refreshTasks: false });
  }
}
