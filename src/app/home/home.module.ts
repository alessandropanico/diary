import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HomePage } from './home.page';
import { HeaderComponent } from '../shared/header/header.component'; // ✅ Importa direttamente HeaderComponent

import { HomePageRoutingModule } from './home-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    HeaderComponent  // ✅ Usa HeaderComponent come modulo standalone
  ],
  declarations: [HomePage]
})
export class HomePageModule {}
