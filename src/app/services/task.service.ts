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
  // Inizializziamo con 'null' per indicare che lo stato delle task non è ancora noto.
  // Solo dopo il primo caricamento (o svuotamento esplicito se non autenticato)
  // emetteremo un array vuoto o le task caricate.
  private tasksSubject = new BehaviorSubject<Task[] | null>(null);
  tasks$: Observable<Task[] | null> = this.tasksSubject.asObservable();

  private db = getFirestore();
  private authStateSubscription: Subscription;

  // Aggiungi una flag per sapere se il caricamento iniziale è già avvenuto
  private initialLoadCompleted: boolean = false;

  constructor() {
    const auth = getAuth();
    this.authStateSubscription = new Subscription();

    this.authStateSubscription.add(
      onAuthStateChanged(auth, async (user: User | null) => {
        if (user) {
          await this.loadTasks();
          this.initialLoadCompleted = true; // Imposta a true dopo il primo caricamento
        } else {
          this.tasksSubject.next([]); // Solo qui emettiamo un array vuoto se non autenticato
          this.initialLoadCompleted = true; // Anche se svuotiamo, il caricamento iniziale è "completato"
        }
      })
    );
  }

  ngOnDestroy() {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
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
      // Se non autenticato e non è stato fatto un caricamento iniziale, emetti null, altrimenti svuota
      if (!this.initialLoadCompleted) {
        this.tasksSubject.next(null); // Mantieni lo stato "non caricato"
      } else {
        this.tasksSubject.next([]); // Se già caricato e poi disconnesso, svuota
      }
      return;
    }

    try {
      const tasksCollectionRef = collection(this.db, `users/${uid}/tasks`);
      const querySnapshot = await getDocs(tasksCollectionRef);
      const loadedTasks: Task[] = [];
      querySnapshot.forEach(docSnap => {
        loadedTasks.push({ id: docSnap.id, ...docSnap.data() as Task });
      });
      loadedTasks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      this.tasksSubject.next(loadedTasks);
    } catch (error) {
      console.error('TaskService: Errore durante il caricamento delle task da Firestore:', error);
      // In caso di errore nel caricamento, potresti voler svuotare le task o gestire l'errore
      this.tasksSubject.next([]); // Svuota le task in caso di errore di caricamento
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

      const currentTasks = this.tasksSubject.value || []; // Gestisce il caso in cui sia ancora null
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
