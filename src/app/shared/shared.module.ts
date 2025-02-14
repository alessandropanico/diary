import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';  // Importa IonicModule se è necessario per altri componenti

@NgModule({
  imports: [
    CommonModule,
    IonicModule  // Esporta solo IonicModule, se necessario
  ],
  exports: [
    IonicModule  // Esporta IonicModule, se usato altrove
  ]
})
export class SharedModule {}
