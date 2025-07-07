export interface Note {
  id: string;
  title: string;
  content: string;
  playlistId: string;
  createdAt?: number;
  updatedAt?: number;
  audioUrl?: string;
  audioBase64?: string;
}
