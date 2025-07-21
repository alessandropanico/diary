// src/app/pagine/classifica/classifica.page.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import { IonInfiniteScroll } from '@ionic/angular'; // Importa IonInfiniteScroll

@Component({
  selector: 'app-classifica',
  templateUrl: './classifica.page.html',
  styleUrls: ['./classifica.page.scss'],
  standalone: false,
})
export class ClassificaPage implements OnInit {

  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll; // Riferimento al componente Infinite Scroll

  // Dati fittizi COMPLETI (simulano il database)
  private allFictionalUsers = [
    { nickname: 'CloudStrife', name: 'Cloud', surname: 'Strife', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 99, expPoints: 999999 },
    { nickname: 'TifaLockhart', name: 'Tifa', surname: 'Lockhart', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 95, expPoints: 850000 },
    { nickname: 'BarretWallace', name: 'Barret', surname: 'Wallace', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 90, expPoints: 700000 },
    { nickname: 'AerithGainsborough', name: 'Aerith', surname: 'Gainsborough', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 88, expPoints: 680000 },
    { nickname: 'RedXIII', name: 'Red', surname: 'XIII', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 85, expPoints: 600000 },
    { nickname: 'YuffieKisaragi', name: 'Yuffie', surname: 'Kisaragi', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 82, expPoints: 550000 },
    { nickname: 'CaitSith', name: 'Cait', surname: 'Sith', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 80, expPoints: 500000 },
    { nickname: 'VincentValentine', name: 'Vincent', surname: 'Valentine', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 78, expPoints: 480000 },
    { nickname: 'CidHighwind', name: 'Cid', surname: 'Highwind', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 75, expPoints: 450000 },
    { nickname: 'Sephiroth', name: 'Sephiroth', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 70, expPoints: 400000 },
    { nickname: 'ZackFair', name: 'Zack', surname: 'Fair', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 68, expPoints: 380000 },
    { nickname: 'JessieRasberry', name: 'Jessie', surname: 'Rasberry', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 65, expPoints: 350000 },
    { nickname: 'Biggs', name: 'Biggs', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 62, expPoints: 320000 },
    { nickname: 'Wedge', name: 'Wedge', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 60, expPoints: 300000 },
    { nickname: 'RufusShinra', name: 'Rufus', surname: 'Shinra', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 55, expPoints: 250000 },
    { nickname: 'Tseng', name: 'Tseng', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 52, expPoints: 220000 },
    { nickname: 'Reno', name: 'Reno', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 50, expPoints: 200000 },
    { nickname: 'Rude', name: 'Rude', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 48, expPoints: 180000 },
    { nickname: 'Elena', name: 'Elena', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 45, expPoints: 150000 },
    { nickname: 'DonCorneo', name: 'Don', surname: 'Corneo', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 40, expPoints: 100000 },
    { nickname: 'Johnny', name: 'Johnny', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 35, expPoints: 80000 },
    { nickname: 'MarleneWallace', name: 'Marlene', surname: 'Wallace', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 30, expPoints: 60000 },
    { nickname: 'ElmyraGainsborough', name: 'Elmyra', surname: 'Gainsborough', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 25, expPoints: 40000 },
    { nickname: 'Dyne', name: 'Dyne', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 20, expPoints: 20000 },
    { nickname: 'Tseng', name: 'Tseng', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 52, expPoints: 220000 },
    { nickname: 'Reno', name: 'Reno', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 50, expPoints: 200000 },
    { nickname: 'Rude', name: 'Rude', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 48, expPoints: 180000 },
    { nickname: 'Elena', name: 'Elena', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 45, expPoints: 150000 },
    { nickname: 'DonCorneo', name: 'Don', surname: 'Corneo', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 40, expPoints: 100000 },
    { nickname: 'Johnny', name: 'Johnny', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 35, expPoints: 80000 },
    { nickname: 'MarleneWallace', name: 'Marlene', surname: 'Wallace', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 30, expPoints: 60000 },
    { nickname: 'ElmyraGainsborough', name: 'Elmyra', surname: 'Gainsborough', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 25, expPoints: 40000 },
    { nickname: 'Dyne', name: 'Dyne', surname: '', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 20, expPoints: 20000 },
    { nickname: 'MrDolphin', name: 'Mr.', surname: 'Dolphin', profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', level: 15, expPoints: 10000 }
  ];


  leaderboardUsers: any[] = []; // Gli utenti attualmente visualizzati nella classifica
  isLoading: boolean = false; // Controlla lo spinner di caricamento
  private currentIndex: number = 0; // Tiene traccia di quanti utenti abbiamo già caricato
  private pageSize: number = 10; // Quanti utenti caricare per volta
  public allUsersLoaded: boolean = false; // Indica se tutti gli utenti fittizi sono stati caricati

  constructor() { }

  ngOnInit() {
    // Ordina i dati fittizi una sola volta all'inizializzazione
    this.allFictionalUsers.sort((a, b) => {
      if (b.level !== a.level) {
        return b.level - a.level;
      }
      return b.expPoints - a.expPoints;
    });

    this.loadUsers(null); // Carica la prima pagina all'inizializzazione
  }

  // loadUsers gestisce il caricamento iniziale e quello per lo scroll infinito
  // L'argomento 'event' è opzionale, utilizzato solo da ion-infinite-scroll
  loadUsers(event: any) {
    if (this.allUsersLoaded && event) { // Se tutti gli utenti sono già caricati, disabilita l'infinite scroll
      event.target.complete();
      event.target.disabled = true;
      return;
    }

    this.isLoading = true; // Mostra lo spinner

    // Simula un ritardo di rete (come se stessimo recuperando dati)
    setTimeout(() => {
      const nextUsers = this.allFictionalUsers.slice(this.currentIndex, this.currentIndex + this.pageSize);
      this.leaderboardUsers = [...this.leaderboardUsers, ...nextUsers];
      this.currentIndex += nextUsers.length;

      this.isLoading = false; // Nascondi lo spinner

      if (event) {
        event.target.complete(); // Segnala a Infinite Scroll che il caricamento è completato
      }

      // Se non ci sono più utenti da caricare, imposta il flag
      if (this.currentIndex >= this.allFictionalUsers.length) {
        this.allUsersLoaded = true;
        if (event) {
          event.target.disabled = true; // Disabilita l'infinite scroll definitivamente
        }
      }
    }, 500); // Ritardo di 0.5 secondi per simulare una chiamata di rete
  }

  // Funzione per ottenere il percorso del trofeo in base alla posizione
  getTrophy(index: number): string {
    if (index === 0) {
      return 'assets/immaginiGenerali/trophy-gold.png';
    } else if (index === 1) {
      return 'assets/immaginiGenerali/trophy-silver.png';
    } else if (index === 2) {
      return 'assets/immaginiGenerali/trophy-bronze.png';
    }
    return '';
  }
}
