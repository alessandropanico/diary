import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FollowersAltroListPage } from './followers-altro-list.page';

const routes: Routes = [
  {
    path: '',
    component: FollowersAltroListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FollowersAltroListPageRoutingModule {}
