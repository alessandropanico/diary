import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NotiziePageRoutingModule } from './notizie-routing.module';

import { NotiziePage } from './notizie.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NotiziePageRoutingModule
  ],
  declarations: [NotiziePage]
})
export class NotiziePageModule {}
