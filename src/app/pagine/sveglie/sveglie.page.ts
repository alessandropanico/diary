import { Component } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Storage } from '@ionic/storage-angular';

@Component({
  selector: 'app-sveglie',
  templateUrl: './sveglie.page.html',
  styleUrls: ['./sveglie.page.scss'],
  standalone: false,
})
export class SvegliePage {
  alarmTime = '';
  alarmNote = '';
  alarms: any[] = [];
  weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  selectedDays: boolean[] = Array(7).fill(true);
  alarmInfo = false;
  editingAlarmIndex: number | null = null;

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    await this.storage.create();
    await this.loadAlarms();
  }

  async loadAlarms() {
    const savedAlarms = await this.storage.get('alarms');
    this.alarms = savedAlarms || [];
    console.log("🔄 Allarmi caricati:", this.alarms);
  }

  isMobile(): boolean {
    return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  async requestNotificationPermission(): Promise<boolean> {
    const { display } = await LocalNotifications.requestPermissions();
    if (display !== 'granted') {
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

    const now = new Date();

    for (let i = 0; i < selectedDaysNames.length; i++) {
      const dayName = selectedDaysNames[i];
      const alarmId = Date.now() + i;
      const targetDay = this.weekDays.indexOf(dayName) + 1;
      const today = new Date().getDay(); // 0 = Domenica
      let daysUntilNext = targetDay - (today === 0 ? 7 : today);
      if (daysUntilNext < 0) daysUntilNext += 7;

      const alarmDate = new Date(now);
      alarmDate.setDate(now.getDate() + daysUntilNext);
      alarmDate.setHours(hours, minutes, 0, 0);

      if (this.isMobile()) {
        try {
          await LocalNotifications.schedule({
            notifications: [{
              id: alarmId,
              title: "⏰ Sveglia",
              body: this.alarmNote || "È ora di svegliarsi!",
              schedule: { at: alarmDate, repeats: true },
              sound: 'assets/sound/lofiAlarm.mp3',
            }],
          });
        } catch (err) {
          console.error("❌ Errore notifica:", err);
        }
      } else {
        const diff = alarmDate.getTime() - now.getTime();
        setTimeout(() => {
          const audio = new Audio('assets/sound/lofiAlarm.mp3');
          audio.play();
          alert(`⏰ Sveglia (${dayName})!`);
        }, diff);
      }

      this.alarms.push({
        id: alarmId,
        time: this.alarmTime,
        note: this.alarmNote,
        days: selectedDaysNames,
        active: true,
      });
    }

    await this.saveAlarms();
    this.resetForm();
  }

  async removeAlarm(index: number) {
    const { id } = this.alarms[index];
    console.log(`🗑 Rimuovendo sveglia ID ${id}`);
    await LocalNotifications.cancel({ notifications: [{ id }] });
    this.alarms.splice(index, 1);
    await this.saveAlarms();
  }

  async toggleAlarm(alarm: any) {
    alarm.active = !alarm.active;

    if (!alarm.active) {
      await LocalNotifications.cancel({ notifications: [{ id: alarm.id }] });
    } else {
      const granted = await this.requestNotificationPermission();
      if (!granted) return;

      const [hours, minutes] = alarm.time.split(':').map(Number);
      const newAlarmTime = new Date();
      newAlarmTime.setHours(hours, minutes, 0, 0);

      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: alarm.id,
            title: "⏰ Sveglia",
            body: alarm.note || "È ora di svegliarsi!",
            schedule: { at: newAlarmTime },
            sound: 'assets/sound/lofiAlarm.mp3',
          }],
        });
      } catch (err) {
        console.error("❌ Errore riattivazione:", err);
      }
    }

    await this.saveAlarms();
  }

  async testAlarm() {
    console.log("🔊 Avvio test sveglia...");
    const audio = new Audio('assets/sound/lofiAlarm.mp3');

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
        console.log("✅ Notifica test programmata!");
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
        audio.play();
      }, 3000);
    }
  }

  async setDefaultAlarm() {
    const granted = await this.requestNotificationPermission();
    if (!granted) return;

    const defaultTime = new Date(Date.now() + 60000);

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: 1,
          title: "⏰ Sveglia Automatica",
          body: "Questa è la sveglia di default",
          schedule: { at: defaultTime },
          sound: 'assets/sound/lofiAlarm.mp3',
        }],
      });

      this.alarms.push({
        id: 1,
        time: `${defaultTime.getHours()}:${defaultTime.getMinutes().toString().padStart(2, '0')}`,
        note: "Sveglia di default",
        days: [],
        active: true,
      });

      await this.saveAlarms();
    } catch (err) {
      console.error("❌ Errore sveglia default:", err);
    }
  }

  openInfo(index: number | null = null) {
    if (index !== null) {
      const alarm = this.alarms[index];
      this.alarmTime = alarm.time;
      this.alarmNote = alarm.note;
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

  async updateAlarm() {
    if (this.editingAlarmIndex === null || !this.alarmTime) {
      return alert('⚠️ Seleziona un orario valido.');
    }

    const granted = await this.requestNotificationPermission();
    if (!granted) return;

    const alarm = this.alarms[this.editingAlarmIndex];
    const [hours, minutes] = this.alarmTime.split(':').map(Number);
    const newTime = new Date();
    newTime.setHours(hours, minutes, 0, 0);

    try {
      await LocalNotifications.cancel({ notifications: [{ id: alarm.id }] });

      await LocalNotifications.schedule({
        notifications: [{
          id: alarm.id,
          title: "⏰ Sveglia Aggiornata",
          body: this.alarmNote || "È ora di svegliarsi!",
          schedule: { at: newTime },
          sound: 'assets/sound/lofiAlarm.mp3',
        }],
      });

      this.alarms[this.editingAlarmIndex] = {
        ...alarm,
        time: this.alarmTime,
        note: this.alarmNote,
        active: true,
      };

      await this.saveAlarms();
      console.log("✅ Sveglia aggiornata.");
    } catch (err) {
      console.error("❌ Errore aggiornamento:", err);
    }

    this.closeInfo();
  }

  private async saveAlarms() {
    await this.storage.set('alarms', this.alarms);
  }

  private resetForm() {
    this.alarmTime = '';
    this.alarmNote = '';
    this.editingAlarmIndex = null;
  }
}
