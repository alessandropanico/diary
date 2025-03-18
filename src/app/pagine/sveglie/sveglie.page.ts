import { Component, OnInit } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AlertController, AlertInput, ModalController } from '@ionic/angular';

interface Alarm {
  time: string;
  label?: string;
  enabled: boolean;
  days: boolean[]; // Array che rappresenta i giorni della settimana (0=Dom, 6=Sab)
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

  constructor(private alertCtrl: AlertController, private modalCtrl: ModalController) { }

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

    // Correggi eventuali sveglie con `days` non definito
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
        ...this.daysOfWeek.map<AlertInput>((day, index) => ({
          type: 'checkbox', // Ora TypeScript accetta il valore
          label: day,
          value: index,
          checked: false
        }))
      ],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Salva',
          handler: (data) => {
            if (data.time) {
              const selectedDays = this.daysOfWeek.map((_, i) => data.includes(i));
              const newAlarm: Alarm = {
                time: data.time,
                label: data.label || '',
                enabled: true,
                days: selectedDays
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



  async selectDays(time: string, label: string, selectedDays: boolean[]) {
    const alert = await this.alertCtrl.create({
      header: 'Seleziona i giorni',
      inputs: this.daysOfWeek.map((day, index) => ({
        type: 'checkbox',
        label: day,
        value: index,
        checked: selectedDays[index]
      })),
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Salva',
          handler: (selectedIndices) => {
            const days = this.daysOfWeek.map((_, i) => selectedIndices.includes(i));

            const newAlarm: Alarm = {
              time,
              label,
              enabled: true,
              days
            };

            this.alarms.push(newAlarm);
            this.saveAlarms();
            this.scheduleNotification(newAlarm);
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
