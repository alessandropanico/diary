import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HomePage } from './home.page';
import { HttpClientModule } from '@angular/common/http';

import { HomePageRoutingModule } from './home-routing.module';
import { RouterModule } from '@angular/router';

//componenti
import { ClockComponent } from './components/clock/clock.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    ClockComponent,
    RouterModule,
    HttpClientModule
  ],
  declarations: [HomePage]  // ✅ Aggiungi HeaderComponent alle dichiarazioni
})
export class HomePageModule {}
