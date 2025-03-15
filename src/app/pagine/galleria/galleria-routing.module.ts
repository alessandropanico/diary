import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GalleriaPage } from './galleria.page';

const routes: Routes = [
  {
    path: '',
    component: GalleriaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GalleriaPageRoutingModule {}
