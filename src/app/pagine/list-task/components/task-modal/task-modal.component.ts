import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { TaskService } from 'src/app/services/task.service';

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './task-modal.component.html',
  styleUrls: ['./task-modal.component.scss'],
})
export class TaskModalComponent {
  newTask = {
    name: '',
    description: '',
    createdAt: new Date().toISOString(),
    dueDate: '',
    completed: false,
  };

  messageSuccess = '';

  constructor(
    private taskService: TaskService,
    private modalCtrl: ModalController,
    private alertController: AlertController
  ) { }

  async addTask() {
    if (this.newTask.name.trim() && this.newTask.dueDate) {
      this.taskService.addTask(this.newTask);
      this.messageSuccess = 'Task aggiunta!';

      // Rimuovi il focus dall'elemento attivo prima di aprire l'alert
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Mostra l'alert e attendi che venga chiuso prima di chiudere il modale
      await this.showGamingAlert(); // ⚠️ aspetta che l'utente prema "Avanti!"
      await this.modalCtrl.dismiss(); // chiudi il modale solo dopo
    }
  }



  async showGamingAlert(): Promise<void> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: '🎯 TASK AGGIUNTA!',
        message: `
        Obiettivo impostato con successo!
      `,
        cssClass: ['gaming-alert', 'alert-dark-force'],
        buttons: [
          {
            text: 'Avanti!',
            role: 'cancel',
            cssClass: 'alert-continue',
            handler: () => {
              resolve(); // solo quando l’utente preme “Avanti”
            }
          },
        ],
        backdropDismiss: false,
        mode: 'ios',
      });

      await alert.present();
    });
  }


  close() {
    this.modalCtrl.dismiss();
  }
}
