import { Component } from '@angular/core';

@Component({
  selector: 'app-riconoscimenti',
  templateUrl: './riconoscimenti.page.html',
  styleUrls: ['./riconoscimenti.page.scss'],
  standalone: false,
})
export class RiconoscimentiPage {
  openLink(url: string) {
    window.open(url, '_blank');
  }
}
