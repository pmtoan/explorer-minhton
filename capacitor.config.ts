import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.minhton.motoexplorer',
  appName: 'Explorer Minhton',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Geolocation: {
      // Background permissions can be configured if needed
    },
  },
};

export default config;
