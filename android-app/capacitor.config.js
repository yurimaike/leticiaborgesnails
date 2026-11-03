/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'br.com.leticiaborgesnails.app',
  appName: 'Letícia Borges Nails',
  webDir: 'www',
  server: {
    url: 'https://leticiaborgesnails.pages.dev',
    cleartext: false,
    allowNavigation: ['leticiaborgesnails.pages.dev']
  }
};

module.exports = config;
