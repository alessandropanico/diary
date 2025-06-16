import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RiconoscimentiPage } from './riconoscimenti.page';

const routes: Routes = [
  {
    path: '',
    component: RiconoscimentiPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RiconoscimentiPageRoutingModule {}
