import { Component, OnInit } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AlertController, Platform } from '@ionic/angular';

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
export class SvegliePage implements OnInit {
  alarms: Alarm[] = [];

  constructor(private alertCtrl: AlertController, private platform: Platform) {}

  async ngOnInit() {
    await this.requestPermissions();
    this.loadAlarms();
  }

  async requestPermissions() {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      console.log('Permesso per le notifiche negato');
    }
  }

  loadAlarms() {
    const storedAlarms = localStorage.getItem('alarms');
    this.alarms = storedAlarms ? JSON.parse(storedAlarms) : [];
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
              this.saveAlarms();
              this.scheduleNotification(newAlarm);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  toggleAlarm(alarm: Alarm) {
    this.saveAlarms();
    if (alarm.enabled) {
      this.scheduleNotification(alarm);
    }
  }

  async scheduleNotification(alarm: Alarm) {
    const [hour, minute] = alarm.time.split(':').map(Number);

    const now = new Date();
    let alarmTime = new Date();
    alarmTime.setHours(hour, minute, 0, 0);

    if (alarmTime < now) {
      alarmTime.setDate(alarmTime.getDate() + 1); // Imposta per il giorno successivo
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: '⏰ Sveglia!',
            body: alarm.label || 'È ora di alzarsi!',
            id: new Date().getTime(),
            schedule: { at: alarmTime },
            sound: 'assets/sounds/lofiAlarm.mp3', // Controlla che il file esista
            smallIcon: 'res://ic_launcher',
            largeIcon: 'res://ic_launcher'
          }
        ]
      });
      console.log('Sveglia impostata per:', alarmTime);
    } catch (error) {
      console.error('Errore nella programmazione della sveglia:', error);
    }
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
            this.alarms.splice(index, 1);
            this.saveAlarms();
          }
        }
      ]
    });
    await alert.present();
  }
}
