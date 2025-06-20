import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
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
    completed: false
  };

  messageSuccess = '';

  constructor(
    private taskService: TaskService,
    private modalCtrl: ModalController
  ) {}

  addTask() {
    if (this.newTask.name.trim() && this.newTask.dueDate) {
      this.taskService.addTask(this.newTask);
      this.messageSuccess = 'Task aggiunta!';
      setTimeout(() => this.modalCtrl.dismiss(), 800);
    }
  }

  close() {
    this.modalCtrl.dismiss();
  }
}
