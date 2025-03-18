import { Component } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AlertController } from '@ionic/angular';

interface Alarm {
  time: string;
  label?: string;
  enabled: boolean;
}


@Component({
  selector: 'app-sveglie',
  templateUrl: './sveglie.page.html',
  styleUrls: ['./sveglie.page.scss'],
  standalone: false,
})

export class SvegliePage {
  alarms: Alarm[] = [
    { time: '07:30', label: 'Buongiorno!', enabled: false },
    { time: '08:00', label: 'Preparati per la giornata', enabled: true }
  ];

  constructor(private alertCtrl: AlertController) {}

  async addAlarm() {
    const alert = await this.alertCtrl.create({
      header: 'Nuova Sveglia',
      inputs: [
        { name: 'time', type: 'time', label: 'Orario' },
        { name: 'label', type: 'text', placeholder: 'Nome sveglia' }
      ],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Salva',
          handler: (data) => {
            if (data.time) {
              this.alarms.push({ time: data.time, label: data.label, enabled: true });
            }
          }
        }
      ]
    });
    await alert.present();
  }

  toggleAlarm(alarm: Alarm) {  // 👈 Aggiunto il tipo Alarm
    if (alarm.enabled) {
      this.scheduleNotification(alarm);
    }
  }

  async scheduleNotification(alarm: Alarm) {  // 👈 Aggiunto il tipo Alarm
    const [hour, minute] = alarm.time.split(':').map(Number);
    await LocalNotifications.schedule({
      notifications: [
        {
          title: '⏰ Sveglia!',
          body: alarm.label || 'È ora di alzarsi!',
          id: new Date().getTime(),
          schedule: { on: { hour, minute } },
        }
      ]
    });
  }
}

