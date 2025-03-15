import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GalleriaPageRoutingModule } from './galleria-routing.module';

import { GalleriaPage } from './galleria.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GalleriaPageRoutingModule
  ],
  declarations: [GalleriaPage]
})
export class GalleriaPageModule {}
