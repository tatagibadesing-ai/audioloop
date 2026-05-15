import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.audioloop.app',
  appName: 'AudioLoop',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
}

export default config
