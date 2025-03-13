// task.component.ts
import { Component, OnInit } from '@angular/core';
import { TaskService } from 'src/app/services/task.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-task',
  templateUrl: './task.component.html',
  styleUrls: ['./task.component.scss'],
  imports: [FormsModule, CommonModule]
})
export class TaskComponent implements OnInit {
  newTask = {
    name: '',
    description: '',
    createdAt: new Date().toISOString(),
    dueDate: '',
    completed: false
  };

  constructor(private taskService: TaskService) { }

  ngOnInit() { }

  addTask() {
    if (this.newTask.name.trim() && this.newTask.dueDate) {
      this.taskService.addTask(this.newTask); // Usa il servizio per aggiungere la task
      this.resetForm();
    } else {
      console.error('❌ Nome o data scadenza mancanti!');
    }
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

  taskOpen = false;

  openTask() {
    this.taskOpen = !this.taskOpen;
  }
}
