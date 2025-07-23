// src/app/interfaces/comment.ts
export interface Comment {
  id: string;
  postId: string; // ID del post a cui appartiene il commento
  userId: string;
  username: string;
  userAvatarUrl?: string; // Opzionale, per l'avatar dell'utente
  text: string;
  timestamp: string; // ISO 8601 string
  likes: string[]; // AGGIUNTO: Array di userId che hanno messo "Mi piace" al commento
}
