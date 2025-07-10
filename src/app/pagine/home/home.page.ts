// src/app/pagine/home/home.page.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { TaskService } from 'src/app/services/task.service';
import { Task } from 'src/app/interfaces/task';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {

  greetingMessage: string = '';
  todayTasks: Task[] = [];
  // Inizializza a true per mostrare il loading. Sarà false solo dopo aver ricevuto un array (anche vuoto)
  isLoadingTasks: boolean = true;
  private tasksSubscription!: Subscription;

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.greetingMessage = this.getGreetingMessage();

    this.tasksSubscription = this.taskService.tasks$.subscribe(tasks => {
      // Se tasks è null, significa che il caricamento iniziale non è ancora avvenuto
      if (tasks === null) {
        this.isLoadingTasks = true; // Mantieni il loader attivo
        this.todayTasks = []; // Assicurati che l'array sia vuoto per non mostrare dati vecchi/errati
      } else {
        // Se tasks non è null (quindi è Task[] o []), allora il caricamento è terminato.
        console.log('HomePage: Ricevute task aggiornate dal servizio. Filtering for today...');
        this.todayTasks = tasks.filter(task => this.isToday(task.dueDate) && !task.completed);
        this.isLoadingTasks = false; // Nascondi il loader
      }
    });
  }

  ngOnDestroy() {
    if (this.tasksSubscription) {
      this.tasksSubscription.unsubscribe();
    }
  }

  // ... (restanti metodi come getGreetingMessage, isToday rimangono invariati)
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
