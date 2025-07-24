// src/app/interfaces/comment.ts
export interface Comment {
  id: string;
  postId: string; // ID del post a cui appartiene il commento
  userId: string;
  username: string;
  userAvatarUrl?: string; // Opzionale, per l'avatar dell'utente
  text: string;
  timestamp: string; // ISO 8601 string
  likes: string[]; // Array di userId che hanno messo "Mi piace" al commento
  parentId?: string | null; // AGGIUNTO: ID del commento a cui si risponde (null per commenti di primo livello)
  replies?: Comment[]; // AGGIUNTO: Array di risposte a questo commento (solo lato client)
}
