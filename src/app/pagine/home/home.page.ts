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
  isLoadingTasks: boolean = true;
  private tasksSubscription!: Subscription;

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.greetingMessage = this.getGreetingMessage();

    this.tasksSubscription = this.taskService.tasks$.subscribe(tasks => {
      if (tasks === null) {
        this.isLoadingTasks = true;
        this.todayTasks = [];
      } else {
        this.todayTasks = tasks.filter(task => this.isToday(task.dueDate) && !task.completed);
        this.isLoadingTasks = false;
      }
    });
  }

  ngOnDestroy() {
    if (this.tasksSubscription) {
      this.tasksSubscription.unsubscribe();
    }
  }

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
