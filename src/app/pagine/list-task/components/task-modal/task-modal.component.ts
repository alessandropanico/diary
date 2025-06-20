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

      await this.showGamingAlert();
      this.modalCtrl.dismiss();
    }
  }


  async showGamingAlert() {
    const alert = await this.alertController.create({
      header: '🎯 Missione Aggiunta!',
      message: `
        Obiettivo impostato con successo.</strong><br>Preparati alla battaglia! ⚔️
      `,
      cssClass: ['gaming-alert', 'alert-dark-force'],
      buttons: [
        {
          text: 'Avanti!',
          role: 'cancel',
          cssClass: 'alert-continue',
        },
      ],
      backdropDismiss: false,
      mode: 'ios', // per uno stile più stabile cross-device
    });

    await alert.present();
  }

  close() {
    this.modalCtrl.dismiss();
  }
}
