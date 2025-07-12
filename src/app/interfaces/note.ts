export interface Note {
  id: string;
  title: string;
  content: string;
  playlistId: string | null; // <-- MODIFICA QUI
  createdAt?: number;
  updatedAt?: number;
  audioUrl?: string;
  audioBase64?: string;
}
