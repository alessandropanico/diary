import { Component, OnInit } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AlertController, ModalController } from '@ionic/angular';

interface Alarm {
  time: string;
  label?: string;
  enabled: boolean;
  days: boolean[]; // Array per i giorni della settimana (0=Dom, 6=Sab)
}

@Component({
  selector: 'app-sveglie',
  templateUrl: './sveglie.page.html',
  styleUrls: ['./sveglie.page.scss'],
  standalone: false,
})
export class SvegliePage implements OnInit {
  alarms: Alarm[] = [];
  daysOfWeek: string[] = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  constructor(private alertCtrl: AlertController, private modalCtrl: ModalController) {}

  async ngOnInit() {
    this.loadAlarms();
    if (this.isNative()) {
      await this.requestPermissions();
    }
  }

  isNative(): boolean {
    return (window as any).Capacitor !== undefined;
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

    // Assicuriamoci che ogni sveglia abbia l'array `days` corretto
    this.alarms.forEach(alarm => {
      if (!Array.isArray(alarm.days) || alarm.days.length !== 7) {
        alarm.days = [false, false, false, false, false, false, false];
      }
    });
  }

  saveAlarms() {
    localStorage.setItem('alarms', JSON.stringify(this.alarms));
  }

  async addAlarm() {
    const alert = await this.alertCtrl.create({
      header: 'Nuova Sveglia',
      inputs: [
        { name: 'time', type: 'time', label: 'Orario' },
        { name: 'label', type: 'text', placeholder: 'Nome sveglia' },
      ],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Salva',
          handler: (data) => {
            if (data.time) {
              const todayIndex = new Date().getDay(); // Giorno attuale (0=Dom, 6=Sab)
              const newAlarm: Alarm = {
                time: data.time,
                label: data.label || '',
                enabled: true,
                days: this.daysOfWeek.map((_, i) => i === todayIndex) // Suona oggi per default
              };
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

  async editAlarmDays(index: number) {
    const alarm = this.alarms[index];

    const alert = await this.alertCtrl.create({
      header: 'Modifica giorni sveglia',
      inputs: this.daysOfWeek.map((day, i) => ({
        type: 'checkbox',
        label: day,
        value: i,
        checked: alarm.days[i]
      })),
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Salva',
          handler: (selectedIndices) => {
            this.alarms[index].days = this.daysOfWeek.map((_, i) => selectedIndices.includes(i));
            this.saveAlarms();
            this.scheduleNotification(this.alarms[index]);
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
    const alarmTime = new Date();
    alarmTime.setHours(hour, minute, 0, 0);

    if (alarmTime < now) {
      alarmTime.setDate(alarmTime.getDate() + 1);
    }

    for (let i = 0; i < 7; i++) {
      if (alarm.days[i]) {
        const scheduledTime = new Date(alarmTime);
        scheduledTime.setDate(scheduledTime.getDate() + ((i - now.getDay() + 7) % 7));

        if (this.isNative()) {
          await LocalNotifications.schedule({
            notifications: [
              {
                title: '⏰ Sveglia!',
                body: alarm.label || 'È ora di alzarsi!',
                id: new Date().getTime(),
                schedule: { at: scheduledTime },
                sound: 'assets/sounds/lofiAlarm.mp3',
              }
            ]
          });
          console.log('Sveglia impostata per:', scheduledTime);
        }
      }
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
