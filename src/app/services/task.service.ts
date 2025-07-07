// src/app/services/task.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Task } from '../interfaces/task'; // Assicurati che l'interfaccia Task abbia 'id?: string;'
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where // Non usiamo 'where' in questo esempio, ma è utile per query più complesse
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // Per ottenere l'UID dell'utente

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private tasksSubject = new BehaviorSubject<Task[]>([]);
  tasks$: Observable<Task[]> = this.tasksSubject.asObservable();

  private db = getFirestore(); // Istanza di Firestore

  constructor() {
    // Non carichiamo più da localStorage all'avvio del servizio.
    // Il caricamento avverrà nel componente che visualizza le task,
    // dopo che l'utente è autenticato.
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
      this.tasksSubject.next([]); // Svuota le task se l'utente non è loggato
      return;
    }

    try {
      // Riferimento alla sottocollezione 'tasks' dell'utente corrente
      const tasksCollectionRef = collection(this.db, `users/${uid}/tasks`);
      const querySnapshot = await getDocs(tasksCollectionRef);
      const loadedTasks: Task[] = [];
      querySnapshot.forEach(docSnap => {
        // Aggiungi l'ID del documento al dato della task
        loadedTasks.push({ id: docSnap.id, ...docSnap.data() as Task });
      });
      // Ordina le task, ad esempio per data di creazione (le più vecchie prima)
      loadedTasks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      this.tasksSubject.next(loadedTasks);
      console.log(`TaskService: Caricate ${loadedTasks.length} task per l'utente ${uid}.`);
    } catch (error) {
      console.error('TaskService: Errore durante il caricamento delle task da Firestore:', error);
      // Qui potresti voler gestire l'errore in modo più user-friendly
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
      throw new Error('Unauthorized'); // Lancia un errore per gestirlo nel componente
    }

    try {
      const tasksCollectionRef = collection(this.db, `users/${uid}/tasks`);
      // addDoc genera un ID del documento automaticamente
      const docRef = await addDoc(tasksCollectionRef, task);
      console.log('TaskService: Task aggiunta con ID:', docRef.id);

      // Aggiorna localmente l'elenco delle task dopo l'aggiunta a Firestore
      const currentTasks = this.tasksSubject.value;
      this.tasksSubject.next([...currentTasks, { id: docRef.id, ...task }]);
    } catch (error) {
      console.error('TaskService: Errore durante l\'aggiunta della task a Firestore:', error);
      throw error; // Rilancia l'errore per gestirlo nel componente
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
      console.log('TaskService: Task eliminata con ID:', taskId);

      // Aggiorna localmente l'elenco delle task dopo l'eliminazione da Firestore
      const currentTasks = this.tasksSubject.value;
      this.tasksSubject.next(currentTasks.filter(t => t.id !== taskId));
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
      console.log('TaskService: Stato completamento task aggiornato per ID:', taskId);

      // Aggiorna localmente l'elenco delle task
      const currentTasks = this.tasksSubject.value;
      const updatedTasks = currentTasks.map(t =>
        t.id === taskId ? { ...t, completed: completed } : t
      );
      this.tasksSubject.next(updatedTasks);
    } catch (error) {
      console.error('TaskService: Errore durante l\'aggiornamento della task in Firestore:', error);
      throw error;
    }
  }

  // I metodi loadTasks() e saveTasks() basati su localStorage sono stati rimossi.
  // La gestione del salvataggio è ora implicita nelle operazioni di Firestore.
}
