import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProgettiPageRoutingModule } from './progetti-routing.module';

import { ProgettiPage } from './progetti.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProgettiPageRoutingModule
  ],
  declarations: [ProgettiPage]
})
export class ProgettiPageModule {}
