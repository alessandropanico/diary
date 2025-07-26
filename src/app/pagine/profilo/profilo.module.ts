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
import { CommentsModalComponent } from './components/comments-modal/comments-modal.component';
import { CommentItemComponent } from './components/comment-item/comment-item.component';
import { LikeModalComponent } from './components/like-modal/like-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProfiloPageRoutingModule,
    DashboardUtenteComponent,
    EmojiStatusComponent,
    PostComponent,
    CommentSectionComponent,
    CommentsModalComponent,
    CommentItemComponent,
    LikeModalComponent
  ],
  declarations: [ProfiloPage, ]
})
export class ProfiloPageModule {}
