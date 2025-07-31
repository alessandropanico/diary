import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  doc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collectionData,
  startAfter,
  DocumentSnapshot,
  getDoc,
  QueryDocumentSnapshot,
  DocumentData,
  setDoc,
  increment
} from '@angular/fire/firestore';
import { Observable, of, lastValueFrom, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

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
  lastVisible: QueryDocumentSnapshot | null;
  hasMore: boolean;
}


@Injectable({
  providedIn: 'root'
})
export class CommentService {

  private _lastVisibleCommentDoc: QueryDocumentSnapshot | null = null;
  private firestore = inject(Firestore);

  constructor() { }

  resetPagination(): void {
    this._lastVisibleCommentDoc = null;
  }

  private async updatePostCommentsCount(postId: string, change: number): Promise<void> {
    const postRef = doc(this.firestore, `posts`, postId);
    try {
      await updateDoc(postRef, {
        commentsCount: increment(change)
      });

      const postSnap = await getDoc(postRef);
      const currentCount = postSnap.data()?.['commentsCount'] || 0;
      if (currentCount < 0) {
        await updateDoc(postRef, {
          commentsCount: 0
        });
        console.warn(`commentsCount for post ${postId} was negative (${currentCount}), reset to 0.`);
      }

    } catch (error) {
      console.error(`Errore nell'aggiornare commentsCount per post ${postId}:`, error);
    }
  }

  async addComment(
    commentData: Omit<Comment, 'id' | 'timestamp' | 'likes' | 'replies' | 'isRootComment'>
  ): Promise<string> {
    const commentsCollectionRef = collection(this.firestore, `posts/${commentData.postId}/comments`);
    const newCommentRef = doc(commentsCollectionRef);

    const commentToSave = {
      ...commentData,
      id: newCommentRef.id,
      timestamp: serverTimestamp(), // ⭐ MODIFICA QUI ⭐
      likes: [],
      replies: [],
      isRootComment: commentData.parentId === null
    };


    try {
      await setDoc(newCommentRef, commentToSave);
      await this.updatePostCommentsCount(commentData.postId, 1);
      return newCommentRef.id;
    } catch (error) {
      console.error('Errore durante l\'aggiunta del commento:', error);
      throw new Error('Impossibile aggiungere il commento.');
    }
  }

  private convertTimestampToISOString(timestamp: any): string {

    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      return timestamp.toDate().toISOString();
    }
    return timestamp || new Date().toISOString();
  }

  getCommentsForPost(postId: string, commentsLimit: number = 10): Observable<Comment[]> {
    const commentsCollectionRef = collection(this.firestore, `posts/${postId}/comments`);

    const commentsQuery = query(
      commentsCollectionRef,
      where('parentId', '==', null),
      orderBy('timestamp', 'desc'),
      limit(commentsLimit)
    );

    return collectionData(commentsQuery, { idField: 'id' }).pipe(
      map(docs => docs.map(docData => {
        const comment = docData as Comment;
        comment.timestamp = this.convertTimestampToISOString(comment.timestamp);
        comment.replies = comment.replies || [];
        comment.isRootComment = comment.parentId === null;
        return comment;
      })),
      switchMap(async (rootComments) => {
        const commentsWithReplies = await Promise.all(
          rootComments.map(async (comment) => {
            const replies = await lastValueFrom(this.getRepliesForCommentOnce(postId, comment.id));
            comment.replies = replies ? replies.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : [];
            return comment;
          })
        );
        return commentsWithReplies;
      })
    );
  }

  getRepliesForComment(postId: string, parentCommentId: string): Observable<Comment[]> {
    if (!parentCommentId) {
      return of([]);
    }
    const repliesCollectionRef = collection(this.firestore, `posts/${postId}/comments`);
    const repliesQuery = query(
      repliesCollectionRef,
      where('parentId', '==', parentCommentId),
      orderBy('timestamp', 'asc')
    );

    return collectionData(repliesQuery, { idField: 'id' }).pipe(
      map(docs => docs.map(docData => {
        const reply = docData as Comment;
        reply.timestamp = this.convertTimestampToISOString(reply.timestamp);
        reply.isRootComment = false;
        return reply;
      }))
    );
  }

  getRepliesForCommentOnce(postId: string, parentCommentId: string): Observable<Comment[]> {
    if (!parentCommentId) {
      return of([]);
    }
    const repliesCollectionRef = collection(this.firestore, `posts/${postId}/comments`);
    const repliesQuery = query(
      repliesCollectionRef,
      where('parentId', '==', parentCommentId),
      orderBy('timestamp', 'asc')
    );

    return from(getDocs(repliesQuery)).pipe(
      map(querySnapshot => {
        const replies: Comment[] = [];
        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          replies.push({
            id: docSnap.id,
            postId: postId,
            userId: data['userId'],
            username: data['username'],
            userAvatarUrl: data['userAvatarUrl'],
            text: data['text'],
            timestamp: this.convertTimestampToISOString(data['timestamp']), // La riga incriminata
            likes: data['likes'] || [],
            parentId: data['parentId'] || null,
            isRootComment: false
          } as Comment);
        });
        return replies;
      })
    );
  }

  async getCommentsForPostOnce(postId: string, commentsLimit: number = 10): Promise<CommentFetchResult> {
    const commentsCollectionRef = collection(this.firestore, `posts/${postId}/comments`);

    let commentsQuery = query(
      commentsCollectionRef,
      where('parentId', '==', null),
      orderBy('timestamp', 'desc'),
      limit(commentsLimit + 1)
    );

    if (this._lastVisibleCommentDoc) {
      commentsQuery = query(commentsQuery, startAfter(this._lastVisibleCommentDoc));
    }

    const querySnapshot = await getDocs(commentsQuery);
    const comments: Comment[] = [];
    let hasMore = false;

    this._lastVisibleCommentDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] as QueryDocumentSnapshot : null;

    if (querySnapshot.docs.length > commentsLimit) {
      hasMore = true;
    }

    querySnapshot.docs.slice(0, commentsLimit).forEach(docSnap => {
      const data = docSnap.data();
      comments.push({
        id: docSnap.id,
        postId: postId,
        userId: data['userId'],
        username: data['username'],
        userAvatarUrl: data['userAvatarUrl'],
        text: data['text'],
        timestamp: this.convertTimestampToISOString(data['timestamp']),
        likes: data['likes'] || [],
        parentId: data['parentId'] || null,
        replies: [],
        isRootComment: data['parentId'] === null
      } as Comment);
    });

    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await lastValueFrom(this.getRepliesForCommentOnce(postId, comment.id));
        comment.replies = replies ? replies.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : [];
        return comment;
      })
    );

    return { comments: commentsWithReplies, hasMore: hasMore, lastVisible: this._lastVisibleCommentDoc };
  }

  async getCommentByIdOnce(postId: string, commentId: string): Promise<Comment | null> {
    const commentDocRef = doc(this.firestore, `posts/${postId}/comments`, commentId);
    const docSnap = await getDoc(commentDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        postId: postId,
        userId: data['userId'],
        username: data['username'],
        userAvatarUrl: data['userAvatarUrl'],
        text: data['text'],
        timestamp: this.convertTimestampToISOString(data['timestamp']),
        likes: data['likes'] || [],
        parentId: data['parentId'] || null,
        replies: [],
        isRootComment: data['parentId'] === null
      } as Comment;
    } else {
      return null;
    }
  }

  async deleteCommentAndReplies(postId: string, commentId: string): Promise<void> {
    const commentDocRef = doc(this.firestore, `posts/${postId}/comments`, commentId);
    const docSnap = await getDoc(commentDocRef);

    if (!docSnap.exists()) {
      console.error('deleteCommentAndReplies: Commento principale non trovato per ID:', commentId);
      throw new Error('Commento non trovato: impossibile eliminare.');
    }

    const commentData = docSnap.data();
    if (commentData?.['parentId'] !== null) {
      console.error('deleteCommentAndReplies: Tentativo di eliminare una risposta come commento principale. Comment ID:', commentId, 'Parent ID:', commentData?.['parentId']);
      throw new Error('Questo metodo è destinato all\'eliminazione di commenti principali con risposte a cascata. Usa deleteSingleComment per eliminare risposte.');
    }

    const commentsToDeleteIds: string[] = [];
    commentsToDeleteIds.push(commentId);
    await this._collectRepliesToDelete(postId, commentId, commentsToDeleteIds);

    const batch = writeBatch(this.firestore);
    commentsToDeleteIds.forEach(id => {
      const deleteRef = doc(this.firestore, `posts/${postId}/comments`, id);
      batch.delete(deleteRef);
    });

    await batch.commit();
    await this.updatePostCommentsCount(postId, -commentsToDeleteIds.length);
  }

  async deleteSingleComment(postId: string, commentId: string): Promise<void> {
    const commentDocRef = doc(this.firestore, `posts/${postId}/comments`, commentId);
    const docSnap = await getDoc(commentDocRef);

    if (!docSnap.exists()) {
      console.error('deleteSingleComment: Commento/risposta non trovato per ID:', commentId);
      throw new Error('Commento non trovato: impossibile eliminare.');
    }

    await deleteDoc(commentDocRef);
    await this.updatePostCommentsCount(postId, -1);
  }

  async toggleLikeComment(postId: string, commentId: string, userId: string, liked: boolean): Promise<void> {
    const commentDocRef = doc(this.firestore, `posts/${postId}/comments`, commentId);
    if (liked) {
      await updateDoc(commentDocRef, {
        likes: arrayUnion(userId)
      });
    } else {
      await updateDoc(commentDocRef, {
        likes: arrayRemove(userId)
      });
    }
  }

  private async _collectRepliesToDelete(postId: string, parentCommentId: string, ids: string[]): Promise<void> {
    const commentsCollectionRef = collection(this.firestore, `posts/${postId}/comments`);
    let queue = [parentCommentId];
    let visited = new Set<string>();

    while (queue.length > 0) {
      const currentParentId = queue.shift() as string;
      const repliesQuery = query(commentsCollectionRef, where('parentId', '==', currentParentId));
      const repliesSnapshot = await getDocs(repliesQuery);
      repliesSnapshot.forEach(docSnap => {
        if (!visited.has(docSnap.id)) {
          ids.push(docSnap.id);
          queue.push(docSnap.id);
          visited.add(docSnap.id);
        }
      });
    }
  }

  async deleteAllCommentsForPost(postId: string): Promise<void> {
    const commentsRef = collection(this.firestore, `posts/${postId}/comments`);
    const q = query(commentsRef);

    try {
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(this.firestore);
      let deletedCount = 0;
      querySnapshot.forEach(commentDoc => {
        batch.delete(commentDoc.ref);
        deletedCount++;
      });

      await batch.commit();
      const postRef = doc(this.firestore, 'posts', postId);
      const postSnap = await getDoc(postRef);

      if (postSnap.exists()) {
        const currentCommentsCount = postSnap.data()['commentsCount'] || 0;
        const newCommentsCount = Math.max(0, currentCommentsCount - deletedCount);
        await updateDoc(postRef, { commentsCount: newCommentsCount });
      }

    } catch (error) {
      console.error(`Errore durante l'eliminazione di tutti i commenti per il post ${postId}:`, error);
      throw error;
    }
  }
}
