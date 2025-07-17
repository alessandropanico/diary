export interface Note {
  id: string;
  title: string;
  content: string;
  playlistId: string | null;
  createdAt?: number;
  updatedAt?: number;
  audioUrl?: string;
  audioBase64?: string;
  // --- Campi Aggiunti per la logica dei Task ---
  isTask?: boolean; // Indica se la nota è anche un task
  completed?: boolean; // Indica se il task è completato
}
