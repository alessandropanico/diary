import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Task } from '../interfaces/task';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  // BehaviorSubject per mantenere e condividere l'elenco delle task
  private tasksSubject = new BehaviorSubject<Task[]>([]);

  // Observable per osservare le modifiche delle task
  tasks$ = this.tasksSubject.asObservable();

  constructor() {
    this.loadTasks();  // Carica le task dal localStorage all'avvio
  }

  // Carica le task dal localStorage
  loadTasks() {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      this.tasksSubject.next(JSON.parse(savedTasks));
    }
  }

  // Aggiunge una nuova task
  addTask(task: Task) {
    const currentTasks = this.tasksSubject.value;
    this.tasksSubject.next([...currentTasks, task]);
    this.saveTasks();
  }

  // Elimina una task
  deleteTask(index: number) {
    const currentTasks = this.tasksSubject.value;
    currentTasks.splice(index, 1);
    this.tasksSubject.next([...currentTasks]);
    this.saveTasks();
  }

  // Cambia lo stato "completato" di una task
  toggleCompletion(index: number) {
    const currentTasks = this.tasksSubject.value;
    currentTasks[index].completed = !currentTasks[index].completed;
    this.tasksSubject.next([...currentTasks]);
    this.saveTasks();
  }

  // Salva le task nel localStorage
  saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(this.tasksSubject.value));
  }
}
