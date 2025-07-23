export interface Post {
  id: string; // ID univoco del post (generato da Firebase)
  userId: string; // ID dell'utente che ha creato il post
  username: string; // Nome utente dell'autore (per visualizzazione rapida)
  userAvatarUrl: string; // URL dell'avatar dell'autore
  timestamp: string; // Data e ora di creazione del post (ISO string)
  text: string; // Contenuto testuale del post
  imageUrl?: string; // URL opzionale dell'immagine allegata al post
  likes: string[]; // Array di userId che hanno messo "mi piace"
  commentsCount: number; // Conteggio dei commenti (potresti volere un sub-collection per i commenti reali)
}
