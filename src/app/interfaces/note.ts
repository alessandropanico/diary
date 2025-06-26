export interface Note {
  id: string;
  title: string;
  content: string;
  playlistId: string;
  createdAt: number;
  audioUrl?: string; // ⬅️ Aggiunta qui
  audioBase64?: string;     // persistente in localStorage
}
