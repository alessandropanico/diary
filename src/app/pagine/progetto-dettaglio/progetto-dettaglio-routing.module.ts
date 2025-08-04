import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProgettoDettaglioPage } from './progetto-dettaglio.page';

const routes: Routes = [
  {
    path: '',
    component: ProgettoDettaglioPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProgettoDettaglioPageRoutingModule {}
