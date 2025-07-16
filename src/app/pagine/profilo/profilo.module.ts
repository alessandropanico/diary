import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProfiloPageRoutingModule } from './profilo-routing.module';

import { ProfiloPage } from './profilo.page';

import { DashboardUtenteComponent } from './components/dashboard-utente/dashboard-utente.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProfiloPageRoutingModule, DashboardUtenteComponent
  ],
  declarations: [ProfiloPage, ]
})
export class ProfiloPageModule {}
