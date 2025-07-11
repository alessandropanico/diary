import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FollowersListPage } from './followers-list.page';

const routes: Routes = [
  {
    path: '',
    component: FollowersListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FollowersListPageRoutingModule {}
