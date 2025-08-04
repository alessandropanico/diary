import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProgettiPageRoutingModule } from './progetti-routing.module';

import { ProgettiPage } from './progetti.page';
import { ProgettoFormComponent } from "./components/progetto-form/progetto-form.component";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProgettiPageRoutingModule,
    ProgettoFormComponent
],
  declarations: [ProgettiPage]
})
export class ProgettiPageModule {}
