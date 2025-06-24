import { Component, OnInit } from '@angular/core';
import { TaskService } from 'src/app/services/task.service';
import { Task } from 'src/app/interfaces/task';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {

  greetingMessage: string = '';
  todayTasks: Task[] = [];

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.greetingMessage = this.getGreetingMessage();
      // Osserva le task e filtra quelle con scadenza oggi
    this.taskService.tasks$.subscribe(tasks => {
      this.todayTasks = tasks.filter(task => this.isToday(task.dueDate) && !task.completed);
    });
  }

  // Metodo per determinare il messaggio di benvenuto in base all'ora del giorno
  getGreetingMessage(): string {
    const currentHour = new Date().getHours();

    if (currentHour < 12) {
      return 'Buongiorno!';
    } else if (currentHour < 18) {
      return 'Buon pomeriggio!';
    } else {
      return 'Buona sera!';
    }
  }

   isToday(dateString: string): boolean {
  const today = new Date();
  const taskDate = new Date(dateString);

  today.setHours(0, 0, 0, 0);
  taskDate.setHours(0, 0, 0, 0);

  return taskDate.getTime() === today.getTime();
}

}
