import { registerPlugin } from '@capacitor/core';

interface AlarmPlugin {
  setAlarm(options: { time: string; note?: string }): Promise<{ success: boolean }>;
}

const AlarmPlugin = registerPlugin<AlarmPlugin>('AlarmPlugin');

export { AlarmPlugin };
