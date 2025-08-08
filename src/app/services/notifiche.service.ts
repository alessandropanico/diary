import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http'; // Importa se prevedi di usare un'API
// import { AngularFirestore } from '@angular/fire/firestore'; // Per la connessione a Firebase

// Interfaccia per definire la struttura di una notifica
export interface Notifica {
  id: string;
  titolo: string;
  messaggio: string;
  letta: boolean;
  dataCreazione: Date;
  link?: string; // Link opzionale per navigare
}

@Injectable({
  providedIn: 'root'
})
export class NotificheService {
  private _notifiche = new BehaviorSubject<Notifica[]>([]);
  public notifiche$: Observable<Notifica[]> = this._notifiche.asObservable();
  private notificationSound = new Audio('assets/sound/notification.mp3'); // ⭐ NUOVA ISTANZA AUDIO ⭐

  // Nel costruttore inietterai i servizi necessari, come AngularFirestore per Firebase
  constructor(
    // private firestore: AngularFirestore
  ) {
    this.caricaNotifiche();
  }

  // Metodo per aggiungere una nuova notifica
  aggiungiNotifica(notifica: Notifica) {
    const notificheAttuali = this._notifiche.getValue();
    const nuoveNotifiche = [notifica, ...notificheAttuali];
    this._notifiche.next(nuoveNotifiche);
    this.salvaNotifiche(nuoveNotifiche);
    this.playNotificationSound(); // ⭐ Riproduce il suono quando aggiungi una notifica ⭐
  }

  // ⭐ NUOVO METODO: Riproduce il suono delle notifiche ⭐
  private playNotificationSound() {
    this.notificationSound.play().catch(e => console.error("Errore nella riproduzione del suono:", e));
  }

  // Metodo per ottenere il conteggio delle notifiche non lette
  getNumeroNotificheNonLette(): Observable<number> {
    return this.notifiche$.pipe(
      map(notifiche => notifiche.filter(n => !n.letta).length)
    );
  }

  segnaComeLetta(notificaId: string) {
    const notificheAttuali = this._notifiche.getValue();
    const notificheAggiornate = notificheAttuali.map(notifica => {
      if (notifica.id === notificaId) {
        return { ...notifica, letta: true };
      }
      return notifica;
    });
    this._notifiche.next(notificheAggiornate);
    this.salvaNotifiche(notificheAggiornate);
  }

  segnaTutteComeLette() {
    const notificheAttuali = this._notifiche.getValue();
    const notificheAggiornate = notificheAttuali.map(notifica => ({ ...notifica, letta: true }));
    this._notifiche.next(notificheAggiornate);
    this.salvaNotifiche(notificheAggiornate);
  }

  private salvaNotifiche(notifiche: Notifica[]) {
    localStorage.setItem('notifiche', JSON.stringify(notifiche));
  }

  private caricaNotifiche() {
    const notificheSalvato = localStorage.getItem('notifiche');
    if (notificheSalvato) {
      const notifiche = JSON.parse(notificheSalvato);
      this._notifiche.next(notifiche);
    }
  }
}
