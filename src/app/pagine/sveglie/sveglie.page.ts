import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';
@Component({
  selector: 'app-sveglie',
  templateUrl: './sveglie.page.html',
  styleUrls: ['./sveglie.page.scss'],
  imports: [IonicModule, CommonModule] // ✅ Importa i moduli necessari
})
export class SvegliePage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
