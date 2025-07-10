// src/app/pagine/home/home.page.ts

import { Component, OnInit, OnDestroy } from '@angular/core'; // Aggiungi OnDestroy
import { TaskService } from 'src/app/services/task.service';
import { Task } from 'src/app/interfaces/task';
import { Subscription } from 'rxjs'; // Importa Subscription

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy { // Implementa OnDestroy

  greetingMessage: string = '';
  todayTasks: Task[] = [];
  isLoadingTasks: boolean = true; // Imposta a true di default per mostrare il loading all'avvio
  private tasksSubscription!: Subscription; // Per disiscriversi dalla sottoscrizione

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.greetingMessage = this.getGreetingMessage();

    // Osserva le task e filtra quelle con scadenza oggi
    this.tasksSubscription = this.taskService.tasks$.subscribe(tasks => {
      this.todayTasks = tasks.filter(task => this.isToday(task.dueDate) && !task.completed);
      this.isLoadingTasks = false; // Una volta che le task sono state elaborate, nascondi il loading
    });
  }

  ngOnDestroy() {
    // È fondamentale disiscriversi per evitare memory leaks
    if (this.tasksSubscription) {
      this.tasksSubscription.unsubscribe();
    }
  }

  // Metodo per determinare il messaggio di benvenuto in base all'ora del giorno
  getGreetingMessage(): string {
    const currentHour = new Date().getHours();
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = now.toLocaleDateString('it-IT', options);

    if (currentHour < 12) {
      return `Buongiorno!`;
    } else if (currentHour < 18) {
      return `Buon pomeriggio!`;
    } else {
      return `Buona sera!`;
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
