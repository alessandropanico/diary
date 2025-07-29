import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SplashComponent } from './splash/splash.component';
import { SearchModalComponent } from './search-modal/search-modal.component';
import { FormsModule } from '@angular/forms'; // Importa FormsModule

@NgModule({
  declarations: [SplashComponent,
     SearchModalComponent
],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule
  ],
  exports: [
    IonicModule,
    SplashComponent,
    SearchModalComponent
  ]
})
export class SharedModule { }
