import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular'; // Importa IonicModule
import { FormsModule } from '@angular/forms';
import { Task } from 'src/app/interfaces/task';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-task',
  templateUrl: './task.component.html',
  styleUrls: ['./task.component.scss'],
  imports: [IonicModule, FormsModule, CommonModule],
  standalone: true // Importante se usiamo Standalone Component
})
export class TaskComponent implements OnInit {
  tasks: Task[] = []; // Array delle task

  newTask: Task = {  // Task vuota per il form
    name: '',
    description: '',
    createdAt: new Date().toISOString(),
    dueDate: '',
    completed: false
  };

  constructor() {}

  ngOnInit() {
    this.loadTasks(); // Carica le task salvate all'avvio
  }

  loadTasks() {
    const savedTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    this.tasks = savedTasks;
  }

  addTask() {
    if (this.newTask.name && this.newTask.dueDate) {
      this.tasks.push({ ...this.newTask }); // Aggiunge la task all'array
      this.saveTasks(); // Salva nel localStorage
      this.resetForm(); // Resetta il form
    }
  }

  toggleCompletion(index: number) {
    this.tasks[index].completed = !this.tasks[index].completed;
    this.saveTasks();
  }

  deleteTask(index: number) {
    this.tasks.splice(index, 1);
    this.saveTasks();
  }

  saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(this.tasks));
  }

  resetForm() {
    this.newTask = {
      name: '',
      description: '',
      createdAt: new Date().toISOString(),
      dueDate: '',
      completed: false
    };
  }
}
