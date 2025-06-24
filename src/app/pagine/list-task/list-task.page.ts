import { Component, OnInit } from '@angular/core';
import { TaskService } from 'src/app/services/task.service';
import { Task } from 'src/app/interfaces/task';
import { ModalController } from '@ionic/angular';
import { TaskModalComponent } from './components/task-modal/task-modal.component';

@Component({
  selector: 'app-list-task',
  templateUrl: './list-task.page.html',
  styleUrls: ['./list-task.page.scss'],
  standalone: false,
})
export class ListTaskPage implements OnInit {
  tasks: Task[] = [];

  constructor(private taskService: TaskService,
    private modalCtrl: ModalController
  ) { }

ngOnInit() {
  this.taskService.tasks$.subscribe(tasks => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Rende il confronto solo per la data

    tasks.forEach((task, index) => {
      const due = new Date(task.dueDate);
      due.setHours(0, 0, 0, 0); // Anche la task

      if (!task.completed && due < today) {
        this.taskService.toggleCompletion(index); // Flag solo quelle prima di oggi
      }
    });

    this.tasks = tasks;
  });
}



  // Funzione per cambiare lo stato di completamento della task
  toggleCompletion(index: number) {
    this.taskService.toggleCompletion(index);  // Chiamata al servizio per cambiare il completamento
  }

  // Funzione per eliminare una task
  deleteTask(index: number) {
    this.taskService.deleteTask(index);  // Chiamata al servizio per eliminare la task
  }

  async openTaskModal() {
    const modal = await this.modalCtrl.create({
      component: TaskModalComponent,
      cssClass: 'ff7-modal-glow'

    });
    await modal.present();
  }
}
