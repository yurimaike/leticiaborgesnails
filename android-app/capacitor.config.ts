import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.leticiaborgesnails.app',
  appName: 'Letícia Borges Nails',
  webDir: 'www',
  server: {
    url: 'https://leticiaborgesnails.pages.dev',
    cleartext: false,
    allowNavigation: [
      'leticiaborgesnails.pages.dev'
    ]
  }
};

export default config;
