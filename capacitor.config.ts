import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.fa0cc69c441c4305b8c2e99c9ca1b5ea',
  appName: 'Doc Aga',
  webDir: 'dist',
  server: {
    url: 'https://fa0cc69c-441c-4305-b8c2-e99c9ca1b5ea.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
