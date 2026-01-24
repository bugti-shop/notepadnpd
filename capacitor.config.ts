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
    SocialLogin: {
      google: {
        webClientId: '52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com',
      },
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
