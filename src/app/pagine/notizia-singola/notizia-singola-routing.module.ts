import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { NotiziaSingolaPage } from './notizia-singola.page';

const routes: Routes = [
  {
    path: '',
    component: NotiziaSingolaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NotiziaSingolaPageRoutingModule {}
