import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { FotocameraPageRoutingModule } from './fotocamera-routing.module';

import { FotocameraPage } from './fotocamera.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FotocameraPageRoutingModule
  ],
  declarations: [FotocameraPage]
})
export class FotocameraPageModule {}
