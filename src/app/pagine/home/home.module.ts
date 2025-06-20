import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HomePage } from './home.page';

import { HomePageRoutingModule } from './home-routing.module';
import { RouterModule } from '@angular/router';

//componenti
import { TaskComponent } from './components/task/task.component';
import { ClockComponent } from './clock/clock.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    TaskComponent,
    ClockComponent,
    RouterModule
  ],
  declarations: [HomePage]  // ✅ Aggiungi HeaderComponent alle dichiarazioni
})
export class HomePageModule {}
