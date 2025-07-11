import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FollowingAltroListPage } from './following-altro-list.page';

const routes: Routes = [
  {
    path: '',
    component: FollowingAltroListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FollowingAltroListPageRoutingModule {}
