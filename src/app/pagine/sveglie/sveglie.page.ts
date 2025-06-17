import { Component } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Storage } from '@ionic/storage-angular';
import { AlarmPlugin } from 'src/app/plugin/alarm-plugin';

@Component({
  selector: 'app-sveglie',
  templateUrl: './sveglie.page.html',
  styleUrls: ['./sveglie.page.scss'],
  standalone: false
})
export class SvegliePage {
  alarmTime = '';
  alarmNote = '';
  alarms: any[] = [];
  weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  selectedDays: boolean[] = Array(7).fill(true);
  alarmInfo = false;
  editingAlarmIndex: number | null = null;

  ringingAudio: HTMLAudioElement | null = null; // AUDIO ATTIVO

  constructor(private storage: Storage) {
    this.init();
  }

  onOverlayClick(event: MouseEvent) {
    this.closeInfo();
  }


  async init() {
    await this.storage.create();
    await this.loadAlarms();
  }

  async loadAlarms() {
    const savedAlarms = await this.storage.get('alarms');
    this.alarms = savedAlarms || [];
  }

  isMobile(): boolean {
    return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  async requestNotificationPermission(): Promise<boolean> {
    const { display } = await LocalNotifications.requestPermissions();

    if (display !== 'granted') {
      // Prova anche la Notification API se siamo su browser
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert("⚠️ Abilita le notifiche per usare la sveglia.");
          return false;
        }
        return true;
      }
      alert("⚠️ Abilita le notifiche per usare la sveglia.");
      return false;
    }
    return true;
  }


  async setAlarm() {
    if (!this.alarmTime) return alert('⚠️ Inserisci un orario.');
    const granted = await this.requestNotificationPermission();
    if (!granted) return;

    const [hours, minutes] = this.alarmTime.split(':').map(Number);
    const selectedDaysNames = this.weekDays.filter((_, i) => this.selectedDays[i]);
    if (!selectedDaysNames.length) return alert('⚠️ Seleziona almeno un giorno.');

    const baseId = Date.now();
    const now = new Date();
    const generatedIds: number[] = [];

    for (let i = 0; i < 7; i++) {
      if (!this.selectedDays[i]) continue;

      const id = baseId + i;
      generatedIds.push(id);

      const dayOffset = ((i + 1) - (now.getDay() || 7) + 7) % 7;
      const alarmDate = new Date(now);
      alarmDate.setDate(now.getDate() + dayOffset);
      alarmDate.setHours(hours, minutes, 0, 0);

      if (this.isMobile() && /android/i.test(navigator.userAgent)) {
        // Usa plugin nativo per Android
        try {
          await AlarmPlugin.setAlarm({
            time: this.alarmTime,
            note: this.alarmNote || 'Sveglia!',
          });
          console.log('Sveglia nativa impostata');
        } catch (e) {
          console.warn('Errore impostando sveglia nativa, uso notifiche locali', e);
          await this.scheduleNotification(id, alarmDate, this.alarmNote, this.weekDays[i]);
        }
      } else {
        // Usa notifiche locali (iOS, browser, ecc)
        await this.scheduleNotification(id, alarmDate, this.alarmNote, this.weekDays[i]);
      }
    }

    this.alarms.push({
      ids: generatedIds,
      time: this.alarmTime,
      note: this.alarmNote,
      days: selectedDaysNames,
      active: true,
    });

    await this.saveAlarms();
    this.resetForm();
    this.alarmInfo = false;
  }

  async updateAlarm() {
    if (this.editingAlarmIndex === null || !this.alarmTime) {
      return alert('⚠️ Seleziona un orario valido.');
    }

    const granted = await this.requestNotificationPermission();
    if (!granted) return;

    const alarm = this.alarms[this.editingAlarmIndex];
    if (alarm?.ids?.length) {
      await LocalNotifications.cancel({
        notifications: alarm.ids.map((id: number) => ({ id })),
      });
    }

    const [hours, minutes] = this.alarmTime.split(':').map(Number);
    const now = new Date();
    const newIds: number[] = [];
    const newDays = this.weekDays.filter((_, i) => this.selectedDays[i]);

    for (let i = 0; i < 7; i++) {
      if (!this.selectedDays[i]) continue;

      const newId = Date.now() + i;
      newIds.push(newId);

      const dayOffset = ((i + 1) - (now.getDay() || 7) + 7) % 7;
      const alarmDate = new Date(now);
      alarmDate.setDate(now.getDate() + dayOffset);
      alarmDate.setHours(hours, minutes, 0, 0);

      await this.scheduleNotification(newId, alarmDate, this.alarmNote, this.weekDays[i]);
    }

    this.alarms[this.editingAlarmIndex] = {
      ids: newIds,
      time: this.alarmTime,
      note: this.alarmNote,
      days: newDays,
      active: true,
    };

    await this.saveAlarms();
    this.closeInfo();
  }

  async toggleAlarm(alarm: any) {
    if (!alarm.ids || !Array.isArray(alarm.ids)) return;

    if (!alarm.active) {
      await LocalNotifications.cancel({
        notifications: alarm.ids.map((id: number) => ({ id })),
      });
    } else {
      const granted = await this.requestNotificationPermission();
      if (!granted) return;

      const [hours, minutes] = alarm.time.split(':').map(Number);
      const now = new Date();

      for (let i = 0; i < alarm.days.length; i++) {
        const dayIndex = this.weekDays.indexOf(alarm.days[i]);
        const alarmDate = new Date(now);
        const dayOffset = ((dayIndex + 1) - (now.getDay() || 7) + 7) % 7;

        alarmDate.setDate(now.getDate() + dayOffset);
        alarmDate.setHours(hours, minutes, 0, 0);

        await this.scheduleNotification(alarm.ids[i], alarmDate, alarm.note, alarm.days[i]);
      }
    }

    alarm.active = !alarm.active;
    await this.saveAlarms();
  }

  async removeAlarm(index: number) {
    const alarm = this.alarms[index];
    if (alarm?.ids) {
      await LocalNotifications.cancel({
        notifications: alarm.ids.map((id: number) => ({ id })),
      });
    }
    this.alarms.splice(index, 1);
    await this.saveAlarms();
  }

  async scheduleNotification(id: number, date: Date, message: string, dayLabel: string) {
    // Se l'orario calcolato è già passato, sposta alla settimana successiva
    if (date.getTime() <= Date.now()) {
      date.setDate(date.getDate() + 7);
    }

    if (this.isMobile()) {
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id,
            title: "⏰ Sveglia",
            body: message || "È ora di svegliarsi!",
            schedule: { at: date },
            sound: 'assets/sound/lofiAlarm.mp3',
          }],
        });
      } catch (err) {
        console.error("❌ Errore notifica:", err);
      }
    } else {
      const diff = date.getTime() - Date.now();
      if (diff <= 0) {
        // Se troppo vicino o passato, suona subito
        this.startRinging(dayLabel, message);
      } else {
        setTimeout(() => {
          this.startRinging(dayLabel, message);
        }, diff);
      }
    }
  }

  async startRinging(dayLabel: string, message: string) {
    this.playRingingAudio();

    // Mostra un alert non bloccante con un pulsante per fermare
    const alert = document.createElement('ion-alert');
    alert.header = '⏰ Sveglia!';
    alert.subHeader = dayLabel;
    alert.message = message || 'È ora di svegliarsi!';
    alert.buttons = [{
      text: 'Ferma',
      role: 'cancel',
      handler: () => {
        this.stopRingingAudio();
      }
    }];

    document.body.appendChild(alert);
    await alert.present();
  }


  stopRingingAudio() {
    if (this.ringingAudio) {
      this.ringingAudio.pause();
      this.ringingAudio.currentTime = 0;
      this.ringingAudio = null;
    }
  }

  openInfo(index: number | null = null) {
    if (index !== null) {
      const alarm = this.alarms[index];
      this.alarmTime = alarm.time;
      this.alarmNote = alarm.note;
      this.selectedDays = this.weekDays.map(d => alarm.days.includes(d));
      this.editingAlarmIndex = index;
    } else {
      this.resetForm();
    }
    this.alarmInfo = true;
  }

  closeInfo() {
    this.alarmInfo = false;
    this.resetForm();
  }

  private async saveAlarms() {
    await this.storage.set('alarms', this.alarms);
  }

  private resetForm() {
    this.alarmTime = '';
    this.alarmNote = '';
    this.selectedDays = Array(7).fill(true);
    this.editingAlarmIndex = null;
  }

  async testAlarm() {
    if (this.isMobile()) {
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: 9999,
            title: "🔊 Test Sveglia",
            body: "Questa è una sveglia di prova!",
            schedule: { at: new Date(Date.now() + 3000) },
            sound: 'assets/sound/lofiAlarm.mp3',
          }],
        });
      } catch (err) {
        console.error("❌ Errore LocalNotifications:", err);
      }
    } else {
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert("⚠️ Permesso notifiche negato.");
          return;
        }
      }

      setTimeout(() => {
        new Notification("🔊 Test Sveglia", {
          body: "Questa è una sveglia di prova!",
          icon: 'assets/icon/icon.png',
        });
        const audio = new Audio('assets/sound/lofiAlarm.mp3');
        audio.play();
      }, 3000);
    }
  }

  playRingingAudio() {
    this.stopRingingAudio(); // Ferma eventuale audio precedente
    this.ringingAudio = new Audio('assets/sound/lofiAlarm.mp3');
    this.ringingAudio.loop = true;
    this.ringingAudio.play().catch(err => {
      console.warn("⚠️ Audio bloccato dal browser o altro errore:", err);
    });
  }


}
