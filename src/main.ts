// src/main.ts

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment'; // Importa la tua configurazione Firebase

// --- Aggiungi queste righe per inizializzare Firebase ---
import { initializeApp } from 'firebase/app';
initializeApp(environment.firebaseConfig);
// --------------------------------------------------------

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
