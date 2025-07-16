import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter', // Puoi mantenerlo così o cambiarlo con un ID più specifico per la tua app, es. 'com.tuoazienda.diaryapp'
  appName: 'diary',
  webDir: 'www',
  server: { // Aggiungi questa sezione per un corretto funzionamento di debug e Live Reload
    androidScheme: 'https'
  },
  plugins: { // ✅ QUESTA È LA SEZIONE DA AGGIUNGERE O MODIFICARE
    Keyboard: {
      resize: 'ionic', // Questa è l'impostazione più comune per risolvere il problema della tastiera
      // inputMode: 'adjustResize', // Puoi aggiungere questa linea, è utile per Android
      // style: 'light' // Opzionale: 'light' o 'dark' per lo stile della tastiera (non l'input)
    }
    // Se hai altri plugin Capacitor, li aggiungeresti qui sotto, es:
    // SplashScreen: {
    //   launchShowDuration: 0
    // }
  }
};

export default config;
