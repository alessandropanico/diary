import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProgettoDettaglioPageRoutingModule } from './progetto-dettaglio-routing.module';

import { ProgettoDettaglioPage } from './progetto-dettaglio.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProgettoDettaglioPageRoutingModule
  ],
  declarations: [ProgettoDettaglioPage]
})
export class ProgettoDettaglioPageModule {}
