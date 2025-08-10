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
  // Aggiornamento: Aggiunta del tipo di notifica 'menzione_post' e 'menzione_commento'
  tipo: 'nuovo_post' | 'mi_piace' | 'commento' | 'menzione_commento' | 'mi_piace_commento' | 'menzione_post';
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

  // Metodo per aggiungere una nuova notifica a Firestore
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
      console.log('Notifica aggiunta con ID: ', docRef.id);
      this.playNotificationSound();
    } catch (e) {
      console.error('Errore nell\'aggiunta della notifica:', e);
    }
  }

  // Nuovo metodo per gestire le notifiche di menzione in un post
  async aggiungiNotificaMenzionePost(taggedUserId: string, taggingUsername: string, postId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione'> = {
      userId: taggedUserId,
      titolo: 'Sei stato menzionato in un post!',
      messaggio: `${taggingUsername} ti ha menzionato in un post.`,
      letta: false,
      postId: postId,
      link: `/post/${postId}`, // Assumendo che esista una pagina per il singolo post
      tipo: 'menzione_post',
    };
    await this.aggiungiNotifica(notifica);
  }

  // ⭐⭐ NUOVO METODO AGGIUNTO QUI ⭐⭐
  // Metodo per gestire le notifiche di menzione in un commento
  async aggiungiNotificaMenzioneCommento(taggedUserId: string, taggingUsername: string, postId: string, commentId: string) {
    const notifica: Omit<Notifica, 'id' | 'dataCreazione'> = {
      userId: taggedUserId,
      titolo: 'Sei stato menzionato in un commento!',
      messaggio: `${taggingUsername} ti ha menzionato in un commento.`,
      letta: false,
      postId: postId,
      commentId: commentId,
      link: `/post/${postId}?commentId=${commentId}`, // Link al post e al commento specifico
      tipo: 'menzione_commento',
    };
    await this.aggiungiNotifica(notifica);
  }
  // ⭐⭐ FINE NUOVO METODO ⭐⭐

  // Metodo per caricare le notifiche dell'utente loggato da Firestore
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

  // Segna una notifica come letta in Firestore
  async segnaComeLetta(notificaId: string) {
    try {
      const notificaRef = doc(this.firestore, 'notifiche', notificaId);
      await updateDoc(notificaRef, { letta: true });
    } catch (e) {
      console.error('Errore nell\'aggiornamento della notifica:', e);
    }
  }

  // Segna tutte le notifiche come lette per l'utente corrente in Firestore
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
}
