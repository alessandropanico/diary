import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { FollowingAltroListPageRoutingModule } from './following-altro-list-routing.module';

import { FollowingAltroListPage } from './following-altro-list.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FollowingAltroListPageRoutingModule
  ],
  declarations: [FollowingAltroListPage]
})
export class FollowingAltroListPageModule {}
