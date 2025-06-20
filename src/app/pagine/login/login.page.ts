import { Component, NgZone, OnInit } from '@angular/core';

declare const google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {

  user: any = null;

  constructor(private ngZone: NgZone) { }

  ngOnInit() {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.user = JSON.parse(storedUser);
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      google.accounts.id.initialize({
        client_id: '930951054259-bkspivmuu379s6mg0m7d7ndc2ehfaite.apps.googleusercontent.com',
        callback: (response: any) => this.ngZone.run(() => this.handleCredentialResponse(response))
      });

      google.accounts.id.renderButton(
        document.getElementById('googleSignInDiv'),
        { theme: 'outline', size: 'large' }
      );

      google.accounts.id.prompt();
    };
  }

  handleCredentialResponse(response: any) {
    const userObject = this.parseJwt(response.credential);
    this.user = userObject;
    localStorage.setItem('user', JSON.stringify(userObject));
    alert(`Login effettuato con successo!\nBenvenuto ${userObject.name}`);
  }

  parseJwt(token: string) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Errore decodifica JWT', e);
      return null;
    }
  }

  logout() {
    this.user = null;
    localStorage.removeItem('user');
    alert('Logout effettuato');
  }
}
