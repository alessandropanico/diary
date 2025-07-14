import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ListaUtentiPageRoutingModule } from './lista-utenti-routing.module';

import { ListaUtentiPage } from './lista-utenti.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ListaUtentiPageRoutingModule
  ],
  declarations: [ListaUtentiPage]
})
export class ListaUtentiPageModule {}
