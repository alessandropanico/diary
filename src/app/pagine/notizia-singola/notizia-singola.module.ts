import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NotiziaSingolaPageRoutingModule } from './notizia-singola-routing.module';

import { NotiziaSingolaPage } from './notizia-singola.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NotiziaSingolaPageRoutingModule
  ],
  declarations: [NotiziaSingolaPage]
})
export class NotiziaSingolaPageModule {}
