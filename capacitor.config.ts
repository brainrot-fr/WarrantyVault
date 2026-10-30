import type { CapacitorConfig } from '@capacitor/cli';
import { capacitorAppId } from './src/lib/native-config';

const config: CapacitorConfig = {
  appId: capacitorAppId,
  appName: 'WarrantyVault',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DEFAULT',
    },
  },
};

export default config;
