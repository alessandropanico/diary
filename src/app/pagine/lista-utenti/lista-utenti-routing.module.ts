import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ListaUtentiPage } from './lista-utenti.page';

const routes: Routes = [
  {
    path: '',
    component: ListaUtentiPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ListaUtentiPageRoutingModule {}
