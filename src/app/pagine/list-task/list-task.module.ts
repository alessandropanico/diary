import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ListTaskPageRoutingModule } from './list-task-routing.module';

import { ListTaskPage } from './list-task.page';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ListTaskPageRoutingModule,
    RouterModule
  ],
  declarations: [ListTaskPage]
})
export class ListTaskPageModule {}
