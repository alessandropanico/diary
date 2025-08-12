// src/app/services/notifiche.service.ts

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, limit, addDoc, doc, updateDoc, getDocs, QuerySnapshot, DocumentData, DocumentReference, Firestore, serverTimestamp, onSnapshot, writeBatch } from '@angular/fire/firestore';

// Interfaccia per definire la struttura di una notifica
export interface Notifica {
  id?: string;
  userId: string;
  titolo: string;
  messaggio: string;
  letta: boolean;
  dataCreazione: any;
  link?: string;
  postId?: string;
  commentId?: string;
  projectId?: string;
  // ⭐⭐ NOVITÀ: Aggiungi followerId per risolvere l'errore
  followerId?: string;
  tipo: 'nuovo_post' | 'mi_piace' | 'commento' | 'menzione_commento' | 'mi_piace_commento' | 'menzione_post' | 'invito_progetto' | 'nuovo_follower';
}

@Injectable({
  providedIn: 'root'
})
export class NotificheService implements OnDestroy {
  private firestore: Firestore;
  private auth = getAuth();
  private currentUserId: string | null = null;
  private notificheSubscription: Subscription | undefined;

  private _notifiche = new BehaviorSubject<Notifica[]>([]);
  public notifiche$: Observable<Notifica[]> = this._notifiche.asObservable();
  private notificationSound = new Audio('assets/sound/notification.mp3');

  constructor() {
    this.firestore = getFirestore();
    onAuthStateChanged(this.auth, user => {
      if (user) {
        this.currentUserId = user.uid;
        this.caricaNotifiche();
      } else {
        this.currentUserId = null;
        this._notifiche.next([]);
        this.notificheSubscription?.unsubscribe();
      }
    });
  }

  ngOnDestroy() {
    this.notificheSubscription?.unsubscribe();
  }

  async aggiungiNotifica(notifica: Omit<Notifica, 'id' | 'dataCreazione'>) {
    if (!notifica.userId) {
      console.error("ID utente non specificato per la notifica.");
      return;
    }
    try {
      const docRef = await addDoc(collection(this.firestore, 'notifiche'), {
        ...notifica,
        letta: false,
        dataCreazione: serverTimestamp()
      });
      this.playNotificationSound();
    } catch (e) {
      console.error('Errore nell\'aggiunta della notifica:', e);
    }
  }

  async aggiungiNotificaMenzionePost(taggedUserId: string, taggingUsername: string, postId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione'> = {
      userId: taggedUserId,
      titolo: 'Sei stato menzionato in un post!',
      messaggio: `${taggingUsername} ti ha menzionato in un post.`,
      letta: false,
      postId: postId,
      link: `/post/${postId}`,
      tipo: 'menzione_post',
    };
    await this.aggiungiNotifica(notifica);
  }

  async aggiungiNotificaMenzioneCommento(taggedUserId: string, taggingUsername: string, postId: string, commentId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione'> = {
      userId: taggedUserId,
      titolo: 'Sei stato menzionato in un commento!',
      messaggio: `${taggingUsername} ti ha menzionato in un commento.`,
      letta: false,
      postId: postId,
      commentId: commentId,
      link: `/post/${postId}?commentId=${commentId}`,
      tipo: 'menzione_commento',
    };
    await this.aggiungiNotifica(notifica);
  }

  async aggiungiNotificaProgetto(invitedUserId: string, invitingUsername: string, projectId: string, projectName: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione'> = {
      userId: invitedUserId,
      titolo: 'Sei stato aggiunto a un progetto!',
      messaggio: `${invitingUsername} ti ha aggiunto al progetto: ${projectName}.`,
      letta: false,
      projectId: projectId,
      link: `/progetti/${projectId}`,
      tipo: 'invito_progetto',
    };
    await this.aggiungiNotifica(notifica);
  }

  private caricaNotifiche() {
    if (!this.currentUserId) {
      return;
    }
    const notificheRef = collection(this.firestore, 'notifiche');
    const q = query(
      notificheRef,
      where('userId', '==', this.currentUserId),
      orderBy('dataCreazione', 'desc'),
      limit(50)
    );

    this.notificheSubscription = new Observable<QuerySnapshot<DocumentData>>(observer => {
      const unsubscribe = onSnapshot(q, observer);
      return { unsubscribe };
    }).pipe(
      map(snapshot => {
        const notifiche: Notifica[] = [];
        snapshot.forEach(doc => {
          notifiche.push({ id: doc.id, ...doc.data() as Notifica });
        });
        return notifiche;
      })
    ).subscribe({
      next: (notifiche) => {
        this._notifiche.next(notifiche);
      },
      error: (err) => {
        console.error('Errore nella sottoscrizione alle notifiche:', err);
      }
    });
  }

  private playNotificationSound() {
    // this.notificationSound.play().catch(e => console.error("Errore nella riproduzione del suono:", e));
  }

  getNumeroNotificheNonLette(): Observable<number> {
    return this.notifiche$.pipe(
      map(notifiche => notifiche.filter(n => !n.letta).length)
    );
  }

  async segnaComeLetta(notificaId: string) {
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
    const notificheRef = collection(this.firestore, 'notifiche');
    const q = query(
      notificheRef,
      where('userId', '==', this.currentUserId),
      where('letta', '==', false)
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
    const notifica: Omit<Notifica, 'id' | 'dataCreazione'> = {
      userId: followedUserId,
      titolo: 'Hai un nuovo follower!',
      messaggio: `${followerUsername} ha iniziato a seguirti.`,
      letta: false,
      followerId: followerId,
      tipo: 'nuovo_follower',
    };
    await this.aggiungiNotifica(notifica);
  }
}
