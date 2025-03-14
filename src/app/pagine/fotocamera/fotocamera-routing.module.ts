import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FotocameraPage } from './fotocamera.page';

const routes: Routes = [
  {
    path: '',
    component: FotocameraPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FotocameraPageRoutingModule {}
