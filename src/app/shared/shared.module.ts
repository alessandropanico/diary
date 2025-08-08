import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SplashComponent } from './splash/splash.component';
import { SearchModalComponent } from './search-modal/search-modal.component';
import { FormsModule } from '@angular/forms';
import { NotificationsModalComponent } from './notifications-modal/notifications-modal.component';

@NgModule({
  declarations: [
     SplashComponent,
     SearchModalComponent,
     NotificationsModalComponent
],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule
  ],
  exports: [
    IonicModule,
    SplashComponent,
    SearchModalComponent,
    NotificationsModalComponent
  ]
})
export class SharedModule { }
