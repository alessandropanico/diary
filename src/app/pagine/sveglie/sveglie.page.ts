import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HeaderComponent } from '../../shared/header/header.component'; // ✅ Importa HeaderComponent
import { IonicModule } from '@ionic/angular';
@Component({
  selector: 'app-sveglie',
  templateUrl: './sveglie.page.html',
  styleUrls: ['./sveglie.page.scss'],
  imports: [IonicModule, CommonModule, HeaderComponent] // ✅ Importa i moduli necessari
})
export class SvegliePage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
