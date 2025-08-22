import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, of, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, limit, addDoc, doc, updateDoc, getDocs, QuerySnapshot, DocumentData, Firestore, serverTimestamp, startAfter, onSnapshot, writeBatch, Timestamp } from '@angular/fire/firestore';

// Interfaccia per definire la struttura di una notifica
export interface Notifica {
  id?: string;
  userId: string;
  titolo: string;
  messaggio: string;
  letta: boolean;
  dataCreazione: any;
  timestamp: any;
  link?: string;
  postId?: string;
  commentId?: string;
  projectId?: string;
  followerId?: string;
  creatorId?: string; // ⭐ NOVITÀ: Aggiunto il campo per l'ID dell'utente che ha creato l'evento di notifica
  tipo: 'nuovo_post' | 'mi_piace' | 'commento' | 'menzione_commento' | 'mi_piace_commento' | 'menzione_post' | 'invito_progetto' | 'nuovo_follower' | 'menzione_chat';
}

@Injectable({
  providedIn: 'root'
})
export class NotificheService implements OnDestroy {
  private firestore: Firestore;
  private auth = getAuth();
  private currentUserId: string | null = null;
  private unreadCountSubscription: Subscription | undefined;

  private _unreadCount = new BehaviorSubject<number>(0);
  public unreadCount$: Observable<number> = this._unreadCount.asObservable();
  private notificationSound = new Audio('assets/sound/notification.mp3');

  private readonly NOTIFICATION_LIFESPAN_MS = 6 * 7 * 24 * 60 * 60 * 1000;

  constructor() {
    this.firestore = getFirestore();
    onAuthStateChanged(this.auth, user => {
      if (user) {
        this.currentUserId = user.uid;
        this.startUnreadCountListener();
      } else {
        this.currentUserId = null;
        this._unreadCount.next(0);
        this.unreadCountSubscription?.unsubscribe();
      }
    });
  }

  ngOnDestroy() {
    this.unreadCountSubscription?.unsubscribe();
  }

  private startUnreadCountListener() {
    if (!this.currentUserId) {
      this._unreadCount.next(0);
      return;
    }

    const sixWeeksAgo = new Date(Date.now() - this.NOTIFICATION_LIFESPAN_MS);
    const notificheRef = collection(this.firestore, 'notifiche');
    const q = query(
      notificheRef,
      where('userId', '==', this.currentUserId),
      where('letta', '==', false),
      where('timestamp', '>', sixWeeksAgo)
    );

    this.unreadCountSubscription = new Observable<QuerySnapshot<DocumentData>>(observer => {
      const unsubscribe = onSnapshot(q, observer);
      return { unsubscribe };
    }).pipe(
      map(snapshot => snapshot.size)
    ).subscribe({
      next: (count) => {
        this._unreadCount.next(count);
      },
      error: (err) => {
        console.error('Errore nella sottoscrizione al conteggio delle notifiche non lette:', err);
      }
    });
  }

  getNumeroNotificheNonLette(): Observable<number> {
    return this.unreadCount$;
  }

  getNotifichePaginated(userId: string, limitCount: number, lastTimestamp: any | null = null): Observable<Notifica[]> {
    if (!userId) {
      return of([]);
    }

    const sixWeeksAgo = new Date(Date.now() - this.NOTIFICATION_LIFESPAN_MS);

    let notificheQuery = query(
      collection(this.firestore, 'notifiche'),
      where('userId', '==', userId),
      where('timestamp', '>', sixWeeksAgo),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (lastTimestamp) {
      notificheQuery = query(notificheQuery, startAfter(lastTimestamp));
    }

    return from(getDocs(notificheQuery)).pipe(
      map((querySnapshot: QuerySnapshot<DocumentData>) => {
        const notifiche: Notifica[] = [];
        querySnapshot.forEach(doc => {
          notifiche.push({ id: doc.id, ...doc.data() as Notifica });
        });
        return notifiche;
      }),
      catchError(error => {
        console.error('Errore nel caricamento delle notifiche paginato:', error);
        return of([]);
      })
    );
  }

  async aggiungiNotifica(notifica: Omit<Notifica, 'id' | 'dataCreazione' | 'timestamp'>) {
    if (!notifica.userId) {
      console.error("ID utente non specificato per la notifica.");
      return;
    }
    try {
      await addDoc(collection(this.firestore, 'notifiche'), {
        ...notifica,
        letta: false,
        dataCreazione: serverTimestamp(),
        timestamp: serverTimestamp()
      });
      this.playNotificationSound();
    } catch (e) {
      console.error('Errore nell\'aggiunta della notifica:', e);
    }
  }

  // ⭐ AGGIORNATO: Aggiunto creatorId
  async aggiungiNotificaMenzionePost(taggedUserId: string, taggingUsername: string, postId: string, creatorId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione' | 'timestamp'> = {
      userId: taggedUserId,
      titolo: 'Sei stato menzionato in un post!',
      messaggio: `${taggingUsername} ti ha menzionato in un post.`,
      letta: false,
      postId: postId,
      link: `/post/${postId}`,
      tipo: 'menzione_post',
      creatorId: creatorId
    };
    await this.aggiungiNotifica(notifica);
  }

  // ⭐ AGGIORNATO: Aggiunto creatorId
  async aggiungiNotificaMenzioneCommento(taggedUserId: string, taggingUsername: string, postId: string, commentId: string, creatorId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione' | 'timestamp'> = {
      userId: taggedUserId,
      titolo: 'Sei stato menzionato in un commento!',
      messaggio: `${taggingUsername} ti ha menzionato in un commento.`,
      letta: false,
      postId: postId,
      commentId: commentId,
      link: `/post/${postId}?commentId=${commentId}`,
      tipo: 'menzione_commento',
      creatorId: creatorId
    };
    await this.aggiungiNotifica(notifica);
  }

  // ⭐ AGGIORNATO: Aggiunto creatorId
  async aggiungiNotificaProgetto(invitedUserId: string, invitingUsername: string, projectId: string, projectName: string, creatorId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione' | 'timestamp'> = {
      userId: invitedUserId,
      titolo: 'Sei stato aggiunto a un progetto!',
      messaggio: `${invitingUsername} ti ha aggiunto al progetto: ${projectName}.`,
      letta: false,
      projectId: projectId,
      link: `/progetti/${projectId}`,
      tipo: 'invito_progetto',
      creatorId: creatorId
    };
    await this.aggiungiNotifica(notifica);
  }

  // ⭐ AGGIORNATO: Aggiunto creatorId
  async aggiungiNotificaMiPiace(notifiedUserId: string, likerUsername: string, postId: string, creatorId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione' | 'timestamp'> = {
      userId: notifiedUserId,
      titolo: 'Nuovo "Mi piace"!',
      messaggio: `${likerUsername} ha messo mi piace al tuo post.`,
      letta: false,
      postId: postId,
      tipo: 'mi_piace',
      creatorId: creatorId,
    };
    await this.aggiungiNotifica(notifica);
  }

  // ⭐ AGGIORNATO: Aggiunto creatorId
  async aggiungiNotificaMiPiaceCommento(notifiedUserId: string, likerUsername: string, postId: string, commentId: string, creatorId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione' | 'timestamp'> = {
      userId: notifiedUserId,
      titolo: 'Nuovo "Mi piace"!',
      messaggio: `${likerUsername} ha messo mi piace al tuo commento.`,
      letta: false,
      postId: postId,
      commentId: commentId,
      tipo: 'mi_piace_commento',
      creatorId: creatorId,
    };
    await this.aggiungiNotifica(notifica);
  }

  // ⭐⭐ AGGIUNTA QUESTA FUNZIONE ⭐⭐
  async aggiungiNotificaNuovoPost(followedUserId: string, postCreatorUsername: string, postId: string, creatorId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione' | 'timestamp'> = {
      userId: followedUserId,
      titolo: 'Nuovo post!',
      messaggio: `${postCreatorUsername} ha pubblicato un nuovo post.`,
      letta: false,
      postId: postId,
      tipo: 'nuovo_post',
      creatorId: creatorId
    };
    await this.aggiungiNotifica(notifica);
  }

  private playNotificationSound() {
    // this.notificationSound.play().catch(e => console.error("Errore nella riproduzione del suono:", e));
  }

  async segnaComeLetta(notificaId: string, userId: string) {
    if (!userId) {
      console.error("ID utente non specificato per segnare la notifica come letta.");
      return;
    }
    try {
      const notificaRef = doc(this.firestore, 'notifiche', notificaId);
      await updateDoc(notificaRef, { letta: true });
    } catch (e) {
      console.error('Errore nell\'aggiornamento della notifica:', e);
    }
  }

  async segnaTutteComeLette() {
    if (!this.currentUserId) {
      return;
    }
    const sixWeeksAgo = new Date(Date.now() - this.NOTIFICATION_LIFESPAN_MS);
    const notificheRef = collection(this.firestore, 'notifiche');
    const q = query(
      notificheRef,
      where('userId', '==', this.currentUserId),
      where('letta', '==', false),
      where('timestamp', '>', sixWeeksAgo)
    );
    try {
      const snapshot = await getDocs(q);
      const batch = writeBatch(this.firestore);
      snapshot.forEach(doc => {
        batch.update(doc.ref, { letta: true });
      });
      await batch.commit();
    } catch (e) {
      console.error('Errore nell\'aggiornamento di tutte le notifiche:', e);
    }
  }

  async aggiungiNotificaNuovoFollower(followedUserId: string, followerUsername: string, followerId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione' | 'timestamp'> = {
      userId: followedUserId,
      titolo: 'Hai un nuovo follower!',
      messaggio: `${followerUsername} ha iniziato a seguirti.`,
      letta: false,
      followerId: followerId,
      tipo: 'nuovo_follower',
      creatorId: followerId
    };
    await this.aggiungiNotifica(notifica);
  }

  async cleanExpiredNotifications() {
    try {
      const sixWeeksAgo = new Date(Date.now() - this.NOTIFICATION_LIFESPAN_MS);
      const notificheRef = collection(this.firestore, 'notifiche');

      const q = query(
        notificheRef,
        where('timestamp', '<', Timestamp.fromDate(sixWeeksAgo))
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('Nessuna notifica da pulire.');
        return;
      }

      const batch = writeBatch(this.firestore);
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Pulizia completata: eliminate ${snapshot.size} notifiche.`);
    } catch (e) {
      console.error("Errore durante la pulizia delle notifiche:", e);
    }
  }

  async aggiungiNotificaMenzioneChat(taggedUserId: string, taggingUsername: string, groupId: string, creatorId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione' | 'timestamp'> = {
      userId: taggedUserId,
      titolo: 'Sei stato menzionato in una chat!',
      messaggio: `${taggingUsername} ti ha menzionato in una chat di gruppo.`,
      letta: false,
      link: `/chat-gruppo/${groupId}`, // Assicurati che il link porti alla chat corretta
      tipo: 'menzione_chat', // Nuovo tipo di notifica
      creatorId: creatorId,
    };
    await this.aggiungiNotifica(notifica);
  }
}
