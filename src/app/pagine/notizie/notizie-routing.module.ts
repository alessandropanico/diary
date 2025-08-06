import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { NotiziePage } from './notizie.page';

const routes: Routes = [
  {
    path: '',
    component: NotiziePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NotiziePageRoutingModule {}
