export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userAvatarUrl: string;
  text: string;
  timestamp: string;
  likes: string[];
  replies?: Comment[];
  parentId: string | null;
  isRootComment?: boolean;
}

export interface CommentFetchResult {
  comments: Comment[];
  lastVisible: any; 
  hasMore: boolean;
}
