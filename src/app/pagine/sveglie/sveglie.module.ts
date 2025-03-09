import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SvegliePageRoutingModule } from './sveglie-routing.module';
import { SvegliePage } from './sveglie.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SvegliePageRoutingModule,
    SharedModule,
    SvegliePage

  ],
  declarations: [
  ]
})
export class SvegliePageModule { }
