import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { HeaderComponent } from './header/header.component';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    HeaderComponent,
    // Esporta solo IonicModule, se necessario
  ],
  exports: [
    IonicModule,
    HeaderComponent 
  ]
})
export class SharedModule {}
