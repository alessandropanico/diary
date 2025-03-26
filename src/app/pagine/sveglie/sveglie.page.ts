import { Component, OnInit } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AlertController } from '@ionic/angular';

interface Alarm {
  id: number;
  time: string;
  label?: string;
  enabled: boolean;
  days: boolean[];
}

@Component({
  selector: 'app-sveglie',
  templateUrl: './sveglie.page.html',
  styleUrls: ['./sveglie.page.scss'],
  standalone:false,
})
export class SvegliePage implements OnInit {
  alarms: Alarm[] = [];
  daysOfWeek: string[] = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  alarmAudio: HTMLAudioElement;

  constructor(private alertCtrl: AlertController) {
    this.alarmAudio = new Audio();
  }

  ngOnInit() {
    this.loadAlarms();
    this.setupAudio();

    if (this.isNative()) {
      this.requestNativePermissions();
    } else {
      this.requestWebNotificationPermission();
      this.startWebAlarmCheck();
    }
  }

  setupAudio() {
    this.alarmAudio = new Audio();
    this.alarmAudio.src = 'assets/sounds/lofiAlarm.mp3';

    this.alarmAudio.addEventListener('error', () => {
      console.error('Errore: file audio non trovato o formato non supportato.');
    });

    this.alarmAudio.load();
  }


  isNative(): boolean {
    return !!(window as any).Capacitor?.isNativePlatform();
  }

  async requestNativePermissions() {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      console.log('Permesso per le notifiche native negato');
    }
  }

  requestWebNotificationPermission() {
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission !== 'granted') {
          console.log('Notifiche web disabilitate');
        }
      });
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
        { name: 'label', type: 'text', placeholder: 'Nome sveglia' },
      ],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Salva',
          handler: (data) => {
            if (data.time) {
              const newAlarm: Alarm = {
                id: Date.now(),
                time: data.time,
                label: data.label || '',
                enabled: true,
                days: Array(7).fill(false),
              };
              this.alarms.push(newAlarm);
              this.saveAlarms();
              this.scheduleNotification(newAlarm);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async editAlarmTime(index: number) {
    const alarm = this.alarms[index];
    const alert = await this.alertCtrl.create({
      header: 'Modifica orario',
      inputs: [{ name: 'time', type: 'time', value: alarm.time }],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Salva',
          handler: (data) => {
            if (data.time) {
              this.alarms[index].time = data.time;
              this.saveAlarms();
              this.scheduleNotification(this.alarms[index]);
            }
          },
        },
      ],
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
        checked: alarm.days[i],
      })),
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Salva',
          handler: (selectedIndices) => {
            this.alarms[index].days = Array(7).fill(false);
            selectedIndices.forEach((i: number) => {
              this.alarms[index].days[i] = true;
            });
            this.saveAlarms();
            this.scheduleNotification(this.alarms[index]);
          },
        },
      ],
    });

    await alert.present();
  }

  async scheduleNotification(alarm: Alarm) {
    if (this.isNative()) {
      await LocalNotifications.cancel({ notifications: [{ id: alarm.id }] });

      alarm.days.forEach(async (isActive, i) => {
        if (isActive) {
          const scheduledTime = new Date();
          const [hour, minute] = alarm.time.split(':').map(Number);
          scheduledTime.setHours(hour, minute, 0, 0);

          await LocalNotifications.schedule({
            notifications: [
              {
                id: alarm.id,
                title: '⏰ Sveglia!',
                body: alarm.label || 'È ora di alzarsi!',
                schedule: { at: scheduledTime },
                sound: 'assets/sounds/lofiAlarm.mp3',
              },
            ],
          });
        }
      });
    } else {
      if ('Notification' in window && Notification.permission === 'granted') {
        setTimeout(() => {
          new Notification('⏰ Sveglia!', { body: alarm.label || 'È ora di alzarsi!' });
          this.testAudio();
        }, 1000);
      }
    }
  }

  startWebAlarmCheck() {
    setInterval(() => {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      const currentDay = now.getDay();

      this.alarms.forEach((alarm) => {
        if (alarm.enabled && alarm.time === currentTime && alarm.days[currentDay]) {
          this.triggerWebAlarm(alarm);
        }
      });
    }, 60000);
  }

  triggerWebAlarm(alarm: Alarm) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('⏰ Sveglia!', { body: alarm.label || 'È ora di alzarsi!' });
    }
    this.testAudio();
  }

  toggleAlarm(index: number) {
    this.saveAlarms();
    if (this.alarms[index].enabled) {
      this.scheduleNotification(this.alarms[index]);
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
            if (this.isNative()) {
              LocalNotifications.cancel({ notifications: [{ id: this.alarms[index].id }] });
            }
            this.alarms.splice(index, 1);
            this.saveAlarms();
          },
        },
      ],
    });
    await alert.present();
  }

  testAudio() {
    this.alarmAudio.currentTime = 0;
    this.alarmAudio.play().catch(e => console.error('Errore audio:', e));
  }
}
