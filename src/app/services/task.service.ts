// src/app/services/task.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs'; // Importa Subscription
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
import { getAuth, onAuthStateChanged, User } from 'firebase/auth'; // Importa User e onAuthStateChanged

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private tasksSubject = new BehaviorSubject<Task[]>([]);
  tasks$: Observable<Task[]> = this.tasksSubject.asObservable();

  private db = getFirestore();
  private authStateSubscription: Subscription; // Aggiunto per gestire la sottoscrizione all'auth

  constructor() {
    // Inizializza l'ascoltatore dello stato di autenticazione nel costruttore del servizio
    // Questo assicura che loadTasks() venga chiamato non appena l'utente è autenticato.
    const auth = getAuth();
    this.authStateSubscription = new Subscription(); // Inizializza la subscription

    this.authStateSubscription.add(
      onAuthStateChanged(auth, async (user: User | null) => {
        if (user) {
          console.log('TaskService: Utente autenticato, caricamento task iniziali...');
          await this.loadTasks(); // Carica le task non appena l'utente è loggato
        } else {
          console.log('TaskService: Utente non autenticato, svuoto le task.');
          this.tasksSubject.next([]); // Svuota le task se l'utente si disconnette
        }
      })
    );
  }

  // È buona pratica disiscriversi dagli observables quando il servizio non è più necessario
  // Anche se i servizi singleton come questo raramente vengono distrutti.
  ngOnDestroy() {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
  }

  /**
   * Ottiene l'UID dell'utente corrente.
   * @returns L'UID dell'utente o null se non autenticato.
   */
  private getUserUid(): string | null {
    const user = getAuth().currentUser;
    return user ? user.uid : null;
  }

  /**
   * Carica le task dell'utente autenticato da Firestore.
   */
  async loadTasks(): Promise<void> {
    const uid = this.getUserUid();
    if (!uid) {
      console.warn('TaskService: Nessun utente autenticato. Impossibile caricare le task.');
      this.tasksSubject.next([]);
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
      console.log(`TaskService: Caricate ${loadedTasks.length} task da Firestore.`);
    } catch (error) {
      console.error('TaskService: Errore durante il caricamento delle task da Firestore:', error);
      // Potresti voler rimettere in stato di errore o svuotare le task in caso di fallimento grave
    }
  }

  /**
   * Aggiunge una nuova task a Firestore.
   * @param task La task da aggiungere.
   */
  async addTask(task: Task): Promise<void> {
    const uid = this.getUserUid();
    if (!uid) {
      console.error('TaskService: Nessun utente autenticato. Impossibile aggiungere la task.');
      throw new Error('Unauthorized');
    }

    try {
      const tasksCollectionRef = collection(this.db, `users/${uid}/tasks`);
      const docRef = await addDoc(tasksCollectionRef, task);

      const currentTasks = this.tasksSubject.value;
      this.tasksSubject.next([...currentTasks, { id: docRef.id, ...task }]);
      console.log('TaskService: Task aggiunta e BehaviorSubject aggiornato.');
    } catch (error) {
      console.error('TaskService: Errore durante l\'aggiunta della task a Firestore:', error);
      throw error;
    }
  }

  /**
   * Elimina una task da Firestore.
   * @param taskId L'ID della task da eliminare.
   */
  async deleteTask(taskId: string): Promise<void> {
    const uid = this.getUserUid();
    if (!uid) {
      console.error('TaskService: Nessun utente autenticato. Impossibile eliminare la task.');
      throw new Error('Unauthorized');
    }

    try {
      const taskDocRef = doc(this.db, `users/${uid}/tasks`, taskId);
      await deleteDoc(taskDocRef);

      const currentTasks = this.tasksSubject.value;
      this.tasksSubject.next(currentTasks.filter(t => t.id !== taskId));
      console.log('TaskService: Task eliminata e BehaviorSubject aggiornato.');
    } catch (error) {
      console.error('TaskService: Errore durante l\'eliminazione della task da Firestore:', error);
      throw error;
    }
  }

  /**
   * Aggiorna lo stato "completed" di una task in Firestore.
   * @param taskId L'ID della task da aggiornare.
   * @param completed Il nuovo stato di completamento.
   */
  async toggleCompletion(taskId: string, completed: boolean): Promise<void> {
    const uid = this.getUserUid();
    if (!uid) {
      console.error('TaskService: Nessun utente autenticato. Impossibile aggiornare la task.');
      throw new Error('Unauthorized');
    }

    try {
      const taskDocRef = doc(this.db, `users/${uid}/tasks`, taskId);
      await updateDoc(taskDocRef, { completed: completed });

      const currentTasks = this.tasksSubject.value;
      const updatedTasks = currentTasks.map(t =>
        t.id === taskId ? { ...t, completed: completed } : t
      );
      this.tasksSubject.next(updatedTasks);
      console.log('TaskService: Stato task aggiornato e BehaviorSubject aggiornato.');
    } catch (error) {
      console.error('TaskService: Errore durante l\'aggiornamento della task in Firestore:', error);
      throw error;
    }
  }
}
