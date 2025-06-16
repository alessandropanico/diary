import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-clock',
  templateUrl: './clock.component.html',
  styleUrls: ['./clock.component.scss'],
})
export class ClockComponent implements OnInit, OnDestroy {
  time: string = '';
  date: string = '';
  private timer: any;

  weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  ngOnInit() {
    this.updateTime();
    this.timer = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  updateTime() {
    const cd = new Date();
    this.time = this.zeroPadding(cd.getHours(), 2) + ':' +
                this.zeroPadding(cd.getMinutes(), 2) + ':' +
                this.zeroPadding(cd.getSeconds(), 2);
    this.date = this.zeroPadding(cd.getFullYear(), 4) + '-' +
                this.zeroPadding(cd.getMonth() + 1, 2) + '-' +
                this.zeroPadding(cd.getDate(), 2) + ' ' +
                this.weekDays[cd.getDay()];
  }

  zeroPadding(num: number, digit: number): string {
    return (Array(digit).fill('0').join('') + num).slice(-digit);
  }
}
