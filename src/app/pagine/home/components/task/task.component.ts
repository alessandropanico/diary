// task.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonicModule } from '@ionic/angular'; // Importa IonicModule
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-task',
  templateUrl: './task.component.html',
  styleUrls: ['./task.component.scss'],
  imports: [
    IonicModule,
    FormsModule
  ]

})
export class TaskComponent {

  @Input() task: { name: string, completed: boolean } = { name: '', completed: false };
  @Output() taskCompleted = new EventEmitter<boolean>();  // Per notificare la HomePage

  constructor() { }

  ngOnInit() {
    this.loadTasks();
  }

  toggleCompletion() {
    this.task.completed = !this.task.completed;
    this.saveTasks();
    this.taskCompleted.emit(this.task.completed);
  }

  saveTasks() {
    let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const index = tasks.findIndex((task: any) => task.name === this.task.name);
    if (index !== -1) {
      tasks[index] = this.task;
    } else {
      tasks.push(this.task);
    }

    localStorage.setItem('tasks', JSON.stringify(tasks));
  }

  loadTasks() {
    const savedTasks = JSON.parse(localStorage.getItem('tasks') || '[]');

    const savedTask = savedTasks.find((task: any) => task.name === this.task.name);
    if (savedTask) {
      this.task = savedTask;
    }
  }
}
