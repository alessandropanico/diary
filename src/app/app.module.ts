import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { IonicStorageModule } from '@ionic/storage-angular';
import { ServiceWorkerModule } from '@angular/service-worker';
import { RouterModule } from '@angular/router';

import { environment } from 'src/environments/environment';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAnalytics, getAnalytics } from '@angular/fire/analytics';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { SharedModule } from "./shared/shared.module";

@NgModule({
  declarations: [AppComponent,],
  imports: [BrowserModule,
    RouterModule,
    HttpClientModule,
    IonicModule.forRoot(), AppRoutingModule,
    IonicStorageModule.forRoot(),
    ServiceWorkerModule.register('ngsw-worker.js', {
        enabled: !isDevMode(),
        // Register the ServiceWorker as soon as the application is stable
        // or after 30 seconds (whichever comes first).
        registrationStrategy: 'registerWhenStable:30000'
    }) // Inizializza lo storage
    , SharedModule],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
  // ✅ Qui sotto i provider Firebase
  provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
  provideAnalytics(() => getAnalytics()),
  provideFirestore(() => getFirestore()),
  provideAuth(() => getAuth())
  ],
  bootstrap: [AppComponent,],
})
export class AppModule { }
