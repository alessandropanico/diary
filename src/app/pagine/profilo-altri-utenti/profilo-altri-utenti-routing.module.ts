import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProfiloAltriUtentiPage } from './profilo-altri-utenti.page';

const routes: Routes = [
  {
    path: '',
    component: ProfiloAltriUtentiPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProfiloAltriUtentiPageRoutingModule {}
