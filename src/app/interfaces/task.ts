export interface Task {
  id?: string; // Questo è il campo che aggiungiamo. È opzionale perché Firestore lo genera.
  name: string;
  description: string;
  createdAt: string;  // Data di creazione della task
  dueDate: string;    // Data di scadenza della task
  completed: boolean;
}
