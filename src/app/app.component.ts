import { Component, OnInit } from '@angular/core';
import { MenuController } from '@ionic/angular';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
  template: `
    <button *ngIf="showInstallButton" (click)="installApp()">Installa App</button>
    <router-outlet></router-outlet>
  `
})
export class AppComponent implements OnInit {

  profile: any = null;

  constructor(
    private menu: MenuController,
    private authService: AuthService) {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton = true;
    });

  }

  ngOnInit() {
    const storedProfile = localStorage.getItem('profile');
    if (storedProfile) {
      this.profile = JSON.parse(storedProfile);
    }
  }


  deferredPrompt: any;
  showInstallButton = false;

  toggleMenu() {
    this.menu.toggle();
  }

  closeMenu() {
    this.menu.close();  // Chiude il menu dopo il click
  }

  async installApp() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const choiceResult = await this.deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      console.log('Utente ha accettato di installare l\'app');
    } else {
      console.log('Utente ha rifiutato l\'installazione');
    }
    this.deferredPrompt = null;
    this.showInstallButton = false;
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  getProfilePhoto(): string {
    return this.profile?.photo || 'assets/immaginiGenerali/default-avatar.jpg';
  }

  loadProfile() {
    const storedProfile = localStorage.getItem('profile');
    this.profile = storedProfile ? JSON.parse(storedProfile) : null;
  }


}
