import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Task {
  name: string;
  description: string;
  createdAt: string;
  dueDate: string;
  completed: boolean;
}

@Component({
  selector: 'app-task',
  templateUrl: './task.component.html',
  styleUrls: ['./task.component.scss'],
  imports: [IonicModule, FormsModule, CommonModule],
  standalone: true
})
export class TaskComponent implements OnInit {
  tasks: Task[] = [];

  newTask: Task = {
    name: '',
    description: '',
    createdAt: new Date().toISOString(),
    dueDate: '',
    completed: false
  };

  constructor() {}

  ngOnInit() {
    this.loadTasks();
  }



  // ✅ Carica le task dal localStorage all'avvio
  loadTasks() {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      this.tasks = JSON.parse(savedTasks);
    }
  }

  // ✅ Aggiunge una nuova task e la salva subito nel localStorage
  addTask() {
    if (this.newTask.name.trim() && this.newTask.dueDate) {
      this.tasks.push({ ...this.newTask });
      this.saveTasks();
      this.resetForm();
    }
  }

  // ✅ Cambia stato "completato" e aggiorna il localStorage
  toggleCompletion(index: number) {
    this.tasks[index].completed = !this.tasks[index].completed;
    this.saveTasks();
  }

  // ✅ Elimina la task e salva nel localStorage
  deleteTask(index: number) {
    this.tasks.splice(index, 1);
    this.saveTasks();
  }

  // ✅ Salva le task nel localStorage
  saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(this.tasks));
  }

  // ✅ Resetta il form dopo aver aggiunto una task
  resetForm() {
    this.newTask = {
      name: '',
      description: '',
      createdAt: new Date().toISOString(),
      dueDate: '',
      completed: false
    };
  }

  taskOpen:boolean=false;


  openTask(){
    this.taskOpen=!this.taskOpen;
  }


}
