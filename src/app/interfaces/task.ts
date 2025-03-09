export interface Task {
  name: string;
  description: string;
  createdAt: string;  // Data di creazione della task
  dueDate: string;    // Data di scadenza della task
  completed: boolean;
}
