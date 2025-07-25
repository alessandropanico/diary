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
}
