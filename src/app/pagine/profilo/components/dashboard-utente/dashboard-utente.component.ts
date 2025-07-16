// src/app/dashboard-utente/dashboard-utente.component.ts
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-dashboard-utente',
  templateUrl: './dashboard-utente.component.html',
  styleUrls: ['./dashboard-utente.component.scss'],
})
export class DashboardUtenteComponent implements OnInit {

  // Dati di default per le sveglie
  activeAlarmsCount: number = 2;
  totalAlarmsCreated: number = 5;
  lastAlarmInteraction: string = 'Oggi, 10:30'; // Formato leggibile

  // Dati di default per note e liste
  totalNotesCount: number = 8;
  totalListsCount: number = 3;
  incompleteListItems: number = 7;
  lastNoteListInteraction: string = 'Ieri, 18:00'; // Formato leggibile

  constructor() { }

  ngOnInit() {}
}
