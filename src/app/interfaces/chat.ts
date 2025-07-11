// src/app/interfaces/chat.ts

import { QueryDocumentSnapshot } from '@angular/fire/firestore'; // Importa se necessario o rimuovi se non usato qui direttamente. Per ora la lasciamo, ma valuta se è più pulito spostarla se serve solo nel servizio.

// Interfaccia per un singolo messaggio
export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date; // Usiamo Date perché convertiamo Firebase Timestamp a Date
  // Aggiungi altri campi del messaggio se necessari
}

// Interfaccia per i dettagli utente (se hai una collezione 'users')
export interface UserProfile {
  name: string;
  username: string;
  displayName: string;
  profilePhotoUrl: string;
  bio?: string;
}

// Interfaccia per la conversazione estesa (con i dettagli dell'altro partecipante)
export interface ExtendedConversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: any; // Firebase Timestamp
  createdAt: any; // Firebase Timestamp
  chatId: string;
  otherParticipantId: string;
  otherParticipantName: string;
  otherParticipantPhoto: string;
  displayLastMessageAt: string;
}

// Interfaccia per i dati restituiti dalla paginazione dei messaggi
export interface PagedMessages {
  messages: Message[];
  lastVisibleDoc: QueryDocumentSnapshot | null;
  firstVisibleDoc: QueryDocumentSnapshot | null; // Aggiunto per coerenza, se serve in futuro per "next page"
  hasMore: boolean;
}
