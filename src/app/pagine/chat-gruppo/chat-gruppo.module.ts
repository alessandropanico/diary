import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChatGruppoPageRoutingModule } from './chat-gruppo-routing.module';

import { ChatGruppoPage } from './chat-gruppo.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ChatGruppoPageRoutingModule
  ],
  declarations: [ChatGruppoPage]
})
export class ChatGruppoPageModule {}
