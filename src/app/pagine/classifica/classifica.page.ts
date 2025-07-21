// src/app/pagine/classifica/classifica.page.ts
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-classifica',
  templateUrl: './classifica.page.html',
  styleUrls: ['./classifica.page.scss'],
  standalone: false,
})
export class ClassificaPage implements OnInit {

  // Dati fittizi per la classifica
  leaderboardUsers = [
    {
      nickname: 'CloudStrife',
      name: 'Cloud',
      surname: 'Strife',
      profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg', // Sostituisci con URL reali
      level: 99,
      expPoints: 999999
    },
    {
      nickname: 'TifaLockhart',
      name: 'Tifa',
      surname: 'Lockhart',
      profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg',
      level: 95,
      expPoints: 850000
    },
    {
      nickname: 'BarretWallace',
      name: 'Barret',
      surname: 'Wallace',
      profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg',
      level: 90,
      expPoints: 700000
    },
    {
      nickname: 'AerithGainsborough',
      name: 'Aerith',
      surname: 'Gainsborough',
      profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg',
      level: 88,
      expPoints: 680000
    },
    {
      nickname: 'RedXIII',
      name: 'Red',
      surname: 'XIII',
      profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg',
      level: 85,
      expPoints: 600000
    },
    {
      nickname: 'YuffieKisaragi',
      name: 'Yuffie',
      surname: 'Kisaragi',
      profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg',
      level: 82,
      expPoints: 550000
    },
    {
      nickname: 'CaitSith',
      name: 'Cait',
      surname: 'Sith',
      profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg',
      level: 80,
      expPoints: 500000
    },
    {
      nickname: 'VincentValentine',
      name: 'Vincent',
      surname: 'Valentine',
      profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg',
      level: 78,
      expPoints: 480000
    },
    {
      nickname: 'CidHighwind',
      name: 'Cid',
      surname: 'Highwind',
      profilePictureUrl: 'https://ionicframework.com/docs/img/demos/avatar.svg',
      level: 75,
      expPoints: 450000
    }
  ];

  isLoading: boolean = false; // Impostato a false per mostrare subito i dati fittizi

  constructor() { }

  ngOnInit() {
    // Ordina i dati fittizi per livello e poi per EXP (decrescente)
    this.leaderboardUsers.sort((a, b) => {
      if (b.level !== a.level) {
        return b.level - a.level;
      }
      return b.expPoints - a.expPoints;
    });
  }

  // Funzione per ottenere il percorso del trofeo in base alla posizione
  getTrophy(index: number): string {
    if (index === 0) {
      return 'assets/icons/trophy-gold.png';
    } else if (index === 1) {
      return 'assets/icons/trophy-silver.png';
    } else if (index === 2) {
      return 'assets/icons/trophy-bronze.png';
    }
    return '';
  }
}
