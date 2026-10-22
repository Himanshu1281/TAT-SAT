// Google Play pre-launch fixes, applied at prebuild so they survive `expo prebuild`.
// - Drop boot-time triggers from expo-notifications' receiver (the app only receives
//   push; it never schedules local notifications that need restoring after reboot).
// - Drop expo-audio's microphone foreground service and RECORD_AUDIO (no recording).
// - Drop the deprecated android:statusBarColor theme item (edge-to-edge, Android 15).
// - Turn on R8 shrinking/obfuscation for release builds.
const { withAndroidManifest, withAndroidStyles, withGradleProperties } = require('expo/config-plugins');

const GRADLE_PROPS = {
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
};

const NOTIF_RECEIVER = 'expo.modules.notifications.service.NotificationsService';
const RECORDING_SERVICE = 'expo.modules.audio.service.AudioRecordingService';
const REMOVED_PERMISSIONS = ['android.permission.RECORD_AUDIO', 'android.permission.RECEIVE_BOOT_COMPLETED'];

module.exports = function withAndroidPlayFixes(config) {
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    manifest['uses-permission'] = (manifest['uses-permission'] || []).filter(
      (p) => !REMOVED_PERMISSIONS.includes(p.$['android:name'])
    );
    for (const name of REMOVED_PERMISSIONS) {
      manifest['uses-permission'].push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }

    const app = manifest.application[0];
    app.receiver = (app.receiver || []).filter((r) => r.$['android:name'] !== NOTIF_RECEIVER);
    app.receiver.push({
      $: { 'android:name': NOTIF_RECEIVER, 'android:enabled': 'true', 'android:exported': 'false', 'tools:node': 'replace' },
      'intent-filter': [{
        $: { 'android:priority': '-1' },
        action: [
          { $: { 'android:name': 'expo.modules.notifications.NOTIFICATION_EVENT' } },
          { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
        ],
      }],
    });

    app.service = (app.service || []).filter((s) => s.$['android:name'] !== RECORDING_SERVICE);
    app.service.push({ $: { 'android:name': RECORDING_SERVICE, 'tools:node': 'remove' } });
    return cfg;
  });

  config = withAndroidStyles(config, (cfg) => {
    for (const style of cfg.modResults.resources.style || []) {
      if (style.item) style.item = style.item.filter((i) => i.$.name !== 'android:statusBarColor');
    }
    return cfg;
  });
  config = withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(GRADLE_PROPS)) {
      cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === key));
      cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
  return config;
};
