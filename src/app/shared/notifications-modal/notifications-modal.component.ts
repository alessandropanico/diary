import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-notifications-modal',
  templateUrl: './notifications-modal.component.html',
  styleUrls: ['./notifications-modal.component.scss'],
  standalone: false,
})
export class NotificationsModalComponent implements OnInit {
  // Dati fittizi per testare lo scroll e la visualizzazione
  mockNotifications = [
    { title: 'Nuovo messaggio', message: 'Hai un nuovo messaggio da Cloud.', type: 'chat' },
    { title: 'Sei stato taggato', message: 'Tifa ti ha menzionato in un post.', type: 'mention' },
    { title: 'Nuova notizia', message: 'Nuovo post nella sezione notizie.', type: 'news' },
    { title: 'Nuovo messaggio', message: 'Hai un nuovo messaggio da Aerith.', type: 'chat' },
    { title: 'Nuova notizia', message: 'La Shinra Corporation ha un nuovo annuncio.', type: 'news' },
    { title: 'Sei stato taggato', message: 'Barret ti ha menzionato in un commento.', type: 'mention' },
    { title: 'Nuovo messaggio', message: 'Hai un nuovo messaggio da Sephiroth.', type: 'chat' },
    { title: 'Nuova notizia', message: 'Nuove scoperte sul Lifestream.', type: 'news' },
    { title: 'Nuovo messaggio', message: 'Hai un nuovo messaggio da Yuffie.', type: 'chat' },
    { title: 'Sei stato taggato', message: 'Red XIII ti ha menzionato in una discussione.', type: 'mention' },
    { title: 'Nuovo messaggio', message: 'Hai un nuovo messaggio da Vincent.', type: 'chat' },
    { title: 'Nuova notizia', message: 'Aggiornamenti dal reattore Mako.', type: 'news' },
    { title: 'Nuovo messaggio', message: 'Hai un nuovo messaggio da Cid.', type: 'chat' },
    { title: 'Sei stato taggato', message: 'Zack ti ha menzionato in un ricordo.', type: 'mention' },
    { title: 'Nuovo messaggio', message: 'Hai un nuovo messaggio da Biggs.', type: 'chat' },
  ];

  constructor(private modalController: ModalController) { }

  ngOnInit() {}

  // Metodo per chiudere la modale
  dismiss() {
    this.modalController.dismiss();
  }
}
