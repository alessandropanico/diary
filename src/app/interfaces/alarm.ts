export interface Alarm {
  time: string;
  note?: string;
  days: string[];
  active: boolean;
  soundFile?: string; // nome del file selezionato
}
