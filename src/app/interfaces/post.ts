import { UserDashboardCounts } from '../services/user-data.service'; // Importa UserDashboardCounts

export interface Post {
  id: string;
  userId: string;
  username: string;
  userAvatarUrl: string;
  timestamp: string;
  text: string;
  imageUrl?: string;
  likes: string[];
  commentsCount: number;
    likesUsersMap?: Map<string, UserDashboardCounts>; // Mappa degli utenti che hanno messo like per questo post

}
