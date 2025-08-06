import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NotiziePageRoutingModule } from './notizie-routing.module';

import { NotiziePage } from './notizie.page';
import { KeyValuePipe } from '@angular/common';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NotiziePageRoutingModule,
    KeyValuePipe
  ],
  declarations: [NotiziePage]
})
export class NotiziePageModule {}
