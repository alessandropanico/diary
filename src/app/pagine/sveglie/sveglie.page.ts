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
  alarms: Alarm[] = [];

  constructor(private alertCtrl: AlertController) {
    this.loadAlarms(); // Carica le sveglie salvate
  }

  loadAlarms() {
    const storedAlarms = localStorage.getItem('alarms');
    if (storedAlarms) {
      this.alarms = JSON.parse(storedAlarms);
    }
  }

  saveAlarms() {
    localStorage.setItem('alarms', JSON.stringify(this.alarms));
  }

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
              const newAlarm: Alarm = { time: data.time, label: data.label, enabled: true };
              this.alarms.push(newAlarm);
              this.saveAlarms(); // Salva le sveglie aggiornate
            }
          }
        }
      ]
    });
    await alert.present();
  }

  toggleAlarm(alarm: Alarm) {
    this.saveAlarms(); // Salva lo stato aggiornato
    if (alarm.enabled) {
      this.scheduleNotification(alarm);
    }
  }

  async scheduleNotification(alarm: Alarm) {
    const [hour, minute] = alarm.time.split(':').map(Number);
    await LocalNotifications.schedule({
      notifications: [
        {
          title: '⏰ Sveglia!',
          body: alarm.label || 'È ora di alzarsi!',
          id: new Date().getTime(),
          schedule: { on: { hour, minute } },
          sound: 'assets/sounds/lofiAlarm.mp3',
        }
      ]
    });
  }

  async deleteAlarm(index: number) {
    const alert = await this.alertCtrl.create({
      header: 'Elimina sveglia',
      message: 'Sei sicuro di voler eliminare questa sveglia?',
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina',
          handler: () => {
            this.alarms.splice(index, 1); // Rimuove la sveglia dall'array
            this.saveAlarms(); // Salva le modifiche in localStorage
          }
        }
      ]
    });
    await alert.present();
  }
}
