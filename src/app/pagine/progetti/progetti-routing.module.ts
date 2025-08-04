import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProgettiPage } from './progetti.page';

const routes: Routes = [
  {
    path: '',
    component: ProgettiPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProgettiPageRoutingModule {}
