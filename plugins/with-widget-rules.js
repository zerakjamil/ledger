const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

/**
 * react-native-android-widget 0.24.0 depends on androidx.work 2.8.1, whose Room
 * 2.5.0 database is loaded by reflection. AGP 9 runs R8 in strict full mode,
 * where `-keep class X` does not keep X's constructor, so a release build
 * crashes in WorkManager's startup initializer before React Native runs:
 *
 *   Failed to create an instance of class androidx.work.impl.WorkDatabase
 *
 * Upstream issue: sAleksovski/react-native-android-widget#159. These are the two
 * constructors the reflective path needs. They are appended at prebuild time
 * because android/ is generated and not tracked.
 */
const RULES = `
# react-native-android-widget / WorkManager 2.8.1 (see plugins/with-widget-rules.js)
-keep class androidx.work.impl.WorkDatabase_Impl { <init>(); }
-keep class * extends androidx.work.InputMerger { <init>(); }
`;

module.exports = function withWidgetRules(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes('WorkDatabase_Impl')) {
        fs.writeFileSync(file, `${current.trimEnd()}\n${RULES}`);
      }
      return cfg;
    },
  ]);
};
