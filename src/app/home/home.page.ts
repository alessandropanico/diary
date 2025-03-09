import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  
  greetingMessage: string ='';

  constructor() {}

  ngOnInit() {
    this.greetingMessage = this.getGreetingMessage();
  }

  // Metodo per determinare il messaggio di benvenuto in base all'ora del giorno
  getGreetingMessage(): string {
    const currentHour = new Date().getHours();

    if (currentHour < 12) {
      return 'Buongiorno!';
    } else if (currentHour < 18) {
      return 'Buon pomeriggio!';
    } else {
      return 'Buona sera!';
    }
  }
}
