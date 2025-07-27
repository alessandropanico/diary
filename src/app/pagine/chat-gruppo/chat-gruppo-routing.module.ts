import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChatGruppoPage } from './chat-gruppo.page';

const routes: Routes = [
  {
    path: '',
    component: ChatGruppoPage
  },
    {
    path: ':id', // Questo indica che la rotta accetta un parametro chiamato 'id'
    component: ChatGruppoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChatGruppoPageRoutingModule {}
