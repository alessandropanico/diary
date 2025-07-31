import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProfiloAltriUtentiPageRoutingModule } from './profilo-altri-utenti-routing.module';

import { ProfiloAltriUtentiPage } from './profilo-altri-utenti.page';
import { EmojiStatusComponent } from "../profilo/components/emoji-status/emoji-status.component";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProfiloAltriUtentiPageRoutingModule,
    EmojiStatusComponent
],
  declarations: [ProfiloAltriUtentiPage]
})
export class ProfiloAltriUtentiPageModule {}
