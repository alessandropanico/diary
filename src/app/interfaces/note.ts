export interface Note {
  id: string;
  title: string;
  content: string;
  playlistId: string;
  createdAt?: number; // ✅ Ora è opzionale
  updatedAt?: number; // ✅ Ora è opzionale
  audioUrl?: string;
  audioBase64?: string;
}
