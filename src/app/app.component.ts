import { Component } from '@angular/core';
import { MenuController } from '@ionic/angular';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private menu: MenuController) {}

  toggleMenu() {
    this.menu.toggle();
  }

  closeMenu() {
    this.menu.close();  // Chiude il menu dopo il click
  }


}
