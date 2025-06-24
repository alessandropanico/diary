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
    this.minDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  async addTask() {
    const dueDate = new Date(this.newTask.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    // ❌ Protezione extra se qualcuno forza il campo
    if (dueDate < today) {
      const alert = await this.alertController.create({
        header: 'Data non valida',
        message: 'Non puoi inserire una task con data nel passato.',
        buttons: ['OK'],
      });
      return await alert.present();
    }

    if (this.newTask.name.trim() && this.newTask.dueDate) {
      this.taskService.addTask(this.newTask);
      this.messageSuccess = 'Task aggiunta!';

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      await this.showGamingAlert();
      await this.modalCtrl.dismiss();
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

  close() {
    this.modalCtrl.dismiss();
  }
}

