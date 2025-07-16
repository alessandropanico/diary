// src/app/services/task.service.ts

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

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private tasksSubject = new BehaviorSubject<Task[] | null>(null);
  tasks$: Observable<Task[] | null> = this.tasksSubject.asObservable();

  private db = getFirestore();
  private authStateSubscription: Subscription;
  private currentTasksSubscription: Subscription | undefined; // Per la sottoscrizione alle task in tempo reale se la aggiungiamo

  private initialLoadCompleted: boolean = false;

  constructor() {
    const auth = getAuth();
    this.authStateSubscription = new Subscription();

    this.authStateSubscription.add(
      onAuthStateChanged(auth, async (user: User | null) => {
        if (user) {
          await this.loadTasks(); // Carica le task e processa quelle scadute
          this.initialLoadCompleted = true;
        } else {
          this.tasksSubject.next([]);
          this.initialLoadCompleted = true;
        }
      })
    );
  }

  ngOnDestroy() {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
    if (this.currentTasksSubscription) { // Annulla la sottoscrizione se l'hai aggiunta
      this.currentTasksSubscription.unsubscribe();
    }
  }

  private getUserUid(): string | null {
    const user = getAuth().currentUser;
    return user ? user.uid : null;
  }

  async loadTasks(): Promise<void> {
    const uid = this.getUserUid();
    if (!uid) {
      console.warn('TaskService: Nessun utente autenticato. Impossibile caricare le task.');
      if (!this.initialLoadCompleted) {
        this.tasksSubject.next(null);
      } else {
        this.tasksSubject.next([]);
      }
      return;
    }

    try {
      const tasksCollectionRef = collection(this.db, `users/${uid}/tasks`);
      const querySnapshot = await getDocs(tasksCollectionRef); // Usa getDocs per un caricamento singolo

      let loadedTasks: Task[] = [];
      querySnapshot.forEach(docSnap => {
        loadedTasks.push({ id: docSnap.id, ...docSnap.data() as Task });
      });

      // ✅ NUOVA LOGICA: Processa le task scadute SUBITO dopo il caricamento
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tasksToUpdate: Task[] = [];
      loadedTasks.forEach(task => {
        if (task.id && !task.completed) {
          // Assicurati che dueDate sia una stringa di data valida o un oggetto Date
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0); // Normalizza per confronto solo sulla data

          if (dueDate < today) {
            tasksToUpdate.push(task);
          }
        }
      });

      for (const task of tasksToUpdate) {
        try {
          // Chiama direttamente l'update del documento, non usare toggleCompletion qui
          // per evitare un'emissione aggiuntiva dal BehaviorSubject per ogni task.
          // toggleCompletion aggiorna il BehaviorSubject, qui vogliamo solo il write.
          const taskDocRef = doc(this.db, `users/${uid}/tasks`, task.id!);
          await updateDoc(taskDocRef, { completed: true });
          // Aggiorna l'oggetto task direttamente in loadedTasks per riflettere il cambiamento prima dell'emissione
          const index = loadedTasks.findIndex(t => t.id === task.id);
          if (index !== -1) {
            loadedTasks[index].completed = true;
          }
        } catch (error) {
          console.error(`Errore durante il marcare la task "${task.name}" scaduta nel servizio:`, error);
        }
      }

      loadedTasks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      this.tasksSubject.next(loadedTasks); // Emetti le task aggiornate (incluse quelle appena completate)

    } catch (error) {
      console.error('TaskService: Errore durante il caricamento delle task da Firestore:', error);
      this.tasksSubject.next([]);
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
      const docRef = await addDoc(tasksCollectionRef, task);

      const currentTasks = this.tasksSubject.value || [];
      this.tasksSubject.next([...currentTasks, { id: docRef.id, ...task }]);
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
      this.tasksSubject.next(currentTasks.filter(t => t.id !== taskId));
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
    } catch (error) {
      console.error('TaskService: Errore durante l\'aggiornamento della task in Firestore:', error);
      throw error;
    }
  }
}
