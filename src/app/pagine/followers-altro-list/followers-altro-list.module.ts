import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { FollowersAltroListPageRoutingModule } from './followers-altro-list-routing.module';

import { FollowersAltroListPage } from './followers-altro-list.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FollowersAltroListPageRoutingModule
  ],
  declarations: [FollowersAltroListPage]
})
export class FollowersAltroListPageModule {}
