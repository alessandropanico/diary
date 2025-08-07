import { Component, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-riconoscimenti',
  templateUrl: './riconoscimenti.page.html',
  styleUrls: ['./riconoscimenti.page.scss'],
  standalone: false,
})
export class RiconoscimentiPage implements OnDestroy {

  private rewardedAdId = 'ca-app-pub-3940256099942544/5224354917';
  isAdLoading = false;
  isCooldownActive = false;
  cooldownTimeLeft = 0;
  private cooldownTimer: any;
  private readonly COOLDOWN_DURATION = 30; 

  constructor() {
    this.checkCooldown();
  }

  ngOnDestroy() {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }
  }

  openLink(url: string) {
    window.open(url, '_blank');
  }

  checkCooldown() {
    const lastAdTime = localStorage.getItem('lastAdShownTime');
    if (lastAdTime) {
      const now = Date.now();
      const timeElapsed = (now - parseInt(lastAdTime)) / 1000;
      if (timeElapsed < this.COOLDOWN_DURATION) {
        this.startCooldownTimer(this.COOLDOWN_DURATION - timeElapsed);
      }
    }
  }

  startCooldownTimer(duration: number) {
    this.isCooldownActive = true;
    this.cooldownTimeLeft = Math.floor(duration);

    this.cooldownTimer = setInterval(() => {
      this.cooldownTimeLeft--;
      if (this.cooldownTimeLeft <= 0) {
        clearInterval(this.cooldownTimer);
        this.isCooldownActive = false;
      }
    }, 1000);
  }

  showRewardedAd() {
    if (this.isCooldownActive || this.isAdLoading) {
      return;
    }

    this.isAdLoading = true;
    console.log('Tentativo di mostrare un video con reward...');

    // Simulazione di caricamento e visualizzazione dell'annuncio
    // Sostituisci questo blocco con la tua implementazione reale di AdMob
    setTimeout(() => {
      this.isAdLoading = false;
      console.log('Annuncio di test mostrato.');
      alert('Grazie per il tuo supporto! Annuncio di test visualizzato con successo.');

      // Imposta il cooldown dopo la visualizzazione
      localStorage.setItem('lastAdShownTime', Date.now().toString());
      this.startCooldownTimer(this.COOLDOWN_DURATION);

    }, 3000); // Ritardo simulato di 3 secondi per il caricamento
  }
}
