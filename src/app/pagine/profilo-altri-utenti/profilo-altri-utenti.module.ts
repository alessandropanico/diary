import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProfiloAltriUtentiPageRoutingModule } from './profilo-altri-utenti-routing.module';

import { ProfiloAltriUtentiPage } from './profilo-altri-utenti.page';
import { EmojiStatusComponent } from "../profilo/components/emoji-status/emoji-status.component";
import { UserPostsComponent } from "./components/user-posts/user-posts.component";
import { UserDashboardComponent } from "./components/user-dashboard/user-dashboard.component";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProfiloAltriUtentiPageRoutingModule,
    EmojiStatusComponent,
    UserPostsComponent,
    UserDashboardComponent
],
  declarations: [ProfiloAltriUtentiPage]
})
export class ProfiloAltriUtentiPageModule {}
