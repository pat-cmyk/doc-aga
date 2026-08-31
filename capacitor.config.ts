import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goldenforage.docaga',
  appName: 'Doc Aga',
  bundledWebRuntime: false,
  backgroundColor: '#FF117E39',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#117e39",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#117e39",
    },
    Camera: {
      // Prefer non-fullscreen presentation where available (iOS sheet / Android picker)
      presentationStyle: 'popover',
    },
  },
};

export default config;
