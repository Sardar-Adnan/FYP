const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withBackgroundService(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    
    const permissions = androidManifest.manifest['uses-permission'];
    const p1 = 'android.permission.FOREGROUND_SERVICE';
    const p2 = 'android.permission.FOREGROUND_SERVICE_DATA_SYNC';

    if (!permissions.find(p => p.$['android:name'] === p1)) {
      permissions.push({ $: { 'android:name': p1 } });
    }
    if (!permissions.find(p => p.$['android:name'] === p2)) {
      permissions.push({ $: { 'android:name': p2 } });
    }

    const app = androidManifest.manifest.application[0];
    if (!app.service) {
      app.service = [];
    }

    const serviceName = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';
    let existingService = app.service.find(s => s.$['android:name'] === serviceName);
    
    if (existingService) {
      existingService.$['android:foregroundServiceType'] = 'dataSync';
      existingService.$['tools:replace'] = 'android:foregroundServiceType';
    } else {
      app.service.push({
        $: {
          'android:name': serviceName,
          'android:foregroundServiceType': 'dataSync'
        }
      });
    }

    // Also need to ensure xmlns:tools is available
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return config;
  });
};
