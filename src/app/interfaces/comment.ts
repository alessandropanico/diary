// src/app/interfaces/comment.ts
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userAvatarUrl: string; // <-- DEVE ESSERE STRING, NON STRING | UNDEFINED
  text: string;
  timestamp: string; // O Date, a seconda di come la gestisci (Firestore.Timestamp è comune)
  likes: string[]; // Array di user IDs a cui piace
  replies?: Comment[]; // Opzionale, per i commenti annidati, può essere un array vuoto
  parentId: string | null; // ID del commento a cui si risponde, null se commento principale
  isRootComment?: boolean; // Aggiunto per chiarezza, opzionale per il modello dati
}

export interface CommentFetchResult {
  comments: Comment[];
  lastVisible: any; // o DocumentSnapshot per Firestore
  hasMore: boolean;
}
