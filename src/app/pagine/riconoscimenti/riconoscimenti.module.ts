import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { RiconoscimentiPageRoutingModule } from './riconoscimenti-routing.module';

import { RiconoscimentiPage } from './riconoscimenti.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RiconoscimentiPageRoutingModule
  ],
  declarations: [RiconoscimentiPage]
})
export class RiconoscimentiPageModule {}
