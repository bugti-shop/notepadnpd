import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nota.npd.com',
  appName: 'Npd',
  webDir: 'dist',
  server: {
    
    cleartext: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
    },
  },
  // Deep link configuration for OAuth callback
  android: {
    allowMixedContent: true,
  },
};

export default config;
