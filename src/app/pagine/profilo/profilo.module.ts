import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ProfiloPageRoutingModule } from './profilo-routing.module';
import { ProfiloPage } from './profilo.page';

import { DashboardUtenteComponent } from './components/dashboard-utente/dashboard-utente.component';
import { EmojiStatusComponent } from './components/emoji-status/emoji-status.component';
import { PostComponent } from './components/post/post.component';
import { CommentSectionComponent } from './components/comment-section/comment-section.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProfiloPageRoutingModule,
    DashboardUtenteComponent,
    EmojiStatusComponent,
    PostComponent,
    CommentSectionComponent
  ],
  declarations: [ProfiloPage, ]
})
export class ProfiloPageModule {}
