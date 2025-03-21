import { Component, OnInit } from '@angular/core';
import { TaskService } from 'src/app/services/task.service';
import { Task } from 'src/app/interfaces/task';

@Component({
  selector: 'app-list-task',
  templateUrl: './list-task.page.html',
  styleUrls: ['./list-task.page.scss'],
  standalone: false,
})
export class ListTaskPage implements OnInit {
  tasks: Task[] = [];

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    // Abbonati al flusso delle task per ottenere gli aggiornamenti
    this.taskService.tasks$.subscribe(tasks => {
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
}
