import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { FollowersListPageRoutingModule } from './followers-list-routing.module';

import { FollowersListPage } from './followers-list.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FollowersListPageRoutingModule
  ],
  declarations: [FollowersListPage]
})
export class FollowersListPageModule {}
