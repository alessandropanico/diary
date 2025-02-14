import { Component } from '@angular/core';
import { MenuController } from '@ionic/angular';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [IonicModule],  // Importa IonicModule se stai usando componenti Ionic come ion-header

})
export class HeaderComponent {
  constructor(private menu: MenuController) {}

  toggleMenu() {
    this.menu.toggle();
  }
}
