import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SvegliePage } from './sveglie.page';

const routes: Routes = [
  {
    path: '',
    component: SvegliePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SvegliePageRoutingModule {}
