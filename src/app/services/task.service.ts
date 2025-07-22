import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { Task } from '../interfaces/task';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

import { ExpService } from './exp.service';
import { UserDataService } from './user-data.service';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private tasksSubject = new BehaviorSubject<Task[] | null>(null);
  tasks$: Observable<Task[] | null> = this.tasksSubject.asObservable();

  private db = getFirestore();
  private authStateSubscription: Subscription;
  private currentTasksSubscription: Subscription | undefined;

  private initialLoadCompleted: boolean = false;

  constructor(
    private expService: ExpService,
    private userDataService: UserDataService
  ) {
    const auth = getAuth();
    this.authStateSubscription = new Subscription();

    this.authStateSubscription.add(
      onAuthStateChanged(auth, async (user: User | null) => {
        if (user) {
          await this.loadTasks();
          this.initialLoadCompleted = true;
        } else {
          this.tasksSubject.next([]);
          this.initialLoadCompleted = true;
          await this.userDataService.setIncompleteTaskItems(0);
        }
      })
    );
  }

  ngOnDestroy() {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
    if (this.currentTasksSubscription) {
      this.currentTasksSubscription.unsubscribe();
    }
  }

  private getUserUid(): string | null {
    const user = getAuth().currentUser;
    return user ? user.uid : null;
  }

  /**
   * Aggiorna il conteggio delle task incomplete nell'User Data Service.
   * @param tasks L'array corrente di task.
   */
  private async updateIncompleteTasksCount(tasks: Task[]): Promise<void> {
    const incompleteCount = tasks.filter(task => !task.completed).length;
    await this.userDataService.setIncompleteTaskItems(incompleteCount);
  }

  async loadTasks(): Promise<void> {
    const uid = this.getUserUid();
    if (!uid) {
      if (!this.initialLoadCompleted) {
        this.tasksSubject.next(null);
      } else {
        this.tasksSubject.next([]);
      }
      await this.userDataService.setIncompleteTaskItems(0);
      return;
    }

    try {
      const tasksCollectionRef = collection(this.db, `users/${uid}/tasks`);
      const querySnapshot = await getDocs(tasksCollectionRef);

      let loadedTasks: Task[] = [];
      querySnapshot.forEach(docSnap => {
        loadedTasks.push({ id: docSnap.id, ...docSnap.data() as Task });
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tasksToUpdate: Task[] = [];
      let xpFromExpiredTasks = 0;

      loadedTasks.forEach(task => {
        if (task.id && !task.completed) {
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0);

          if (dueDate < today) {
            tasksToUpdate.push(task);
            xpFromExpiredTasks += 5;
          }
        }
      });

      for (const task of tasksToUpdate) {
        try {
          const taskDocRef = doc(this.db, `users/${uid}/tasks`, task.id!);
          await updateDoc(taskDocRef, { completed: true });
          const index = loadedTasks.findIndex(t => t.id === task.id);
          if (index !== -1) {
            loadedTasks[index].completed = true;
          }
        } catch (error) {
          console.error(`Errore durante il marcare la task "${task.name}" scaduta nel servizio:`, error);
        }
      }

      loadedTasks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      this.tasksSubject.next(loadedTasks);

      await this.updateIncompleteTasksCount(loadedTasks);

      if (xpFromExpiredTasks > 0) {
        this.expService.addExperience(xpFromExpiredTasks);
        await this.userDataService.setLastGlobalActivityTimestamp(new Date().toISOString());
      }

    } catch (error) {
      console.error('TaskService: Errore durante il caricamento delle task da Firestore:', error);
      this.tasksSubject.next([]);
      await this.userDataService.setIncompleteTaskItems(0);
    }
  }

  async addTask(task: Task): Promise<void> {
    const uid = this.getUserUid();
    if (!uid) {
      console.error('TaskService: Nessun utente autenticato. Impossibile aggiungere la task.');
      throw new Error('Unauthorized');
    }

    try {
      const tasksCollectionRef = collection(this.db, `users/${uid}/tasks`);
      const taskToSave = { ...task, completed: false, createdAt: new Date().toISOString() };
      const docRef = await addDoc(tasksCollectionRef, taskToSave);

      const currentTasks = this.tasksSubject.value || [];
      const newTaskWithId = { id: docRef.id, ...taskToSave };
      const updatedTasks = [...currentTasks, newTaskWithId];

      this.tasksSubject.next(updatedTasks);

      this.expService.addExperience(5);
      await this.userDataService.setLastTaskInteraction(new Date().toISOString());
      await this.updateIncompleteTasksCount(updatedTasks);

    } catch (error) {
      console.error('TaskService: Errore durante l\'aggiunta della task a Firestore:', error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    const uid = this.getUserUid();
    if (!uid) {
      console.error('TaskService: Nessun utente autenticato. Impossibile eliminare la task.');
      throw new Error('Unauthorized');
    }

    try {
      const taskDocRef = doc(this.db, `users/${uid}/tasks`, taskId);
      await deleteDoc(taskDocRef);

      const currentTasks = this.tasksSubject.value || [];
      const updatedTasks = currentTasks.filter(t => t.id !== taskId); // Crea la nuova lista

      this.tasksSubject.next(updatedTasks); // Aggiorna il BehaviorSubject

      await this.userDataService.setLastTaskInteraction(new Date().toISOString());
      await this.updateIncompleteTasksCount(updatedTasks);

    } catch (error) {
      console.error('TaskService: Errore durante l\'eliminazione della task da Firestore:', error);
      throw error;
    }
  }

  async toggleCompletion(taskId: string, completed: boolean): Promise<void> {
    const uid = this.getUserUid();
    if (!uid) {
      console.error('TaskService: Nessun utente autenticato. Impossibile aggiornare la task.');
      throw new Error('Unauthorized');
    }

    try {
      const taskDocRef = doc(this.db, `users/${uid}/tasks`, taskId);
      await updateDoc(taskDocRef, { completed: completed });

      const currentTasks = this.tasksSubject.value || [];
      const updatedTasks = currentTasks.map(t =>
        t.id === taskId ? { ...t, completed: completed } : t
      );
      this.tasksSubject.next(updatedTasks);

      if (completed) {
        this.expService.addExperience(10);
      }
      await this.userDataService.setLastTaskInteraction(new Date().toISOString());
      await this.updateIncompleteTasksCount(updatedTasks);

    } catch (error) {
      console.error('TaskService: Errore durante l\'aggiornamento della task in Firestore:', error);
      throw error;
    }
  }
}
