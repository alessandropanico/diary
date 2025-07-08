import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SplashComponent } from './splash/splash.component';

@NgModule({
  declarations: [SplashComponent],
  imports: [
    CommonModule,
    IonicModule,

  ],
  exports: [
    IonicModule,
    SplashComponent
  ]
})
export class SharedModule { }
