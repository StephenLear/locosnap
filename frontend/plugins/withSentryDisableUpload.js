/**
 * Custom Expo config plugin — disables Sentry source map / debug symbol upload during EAS builds.
 *
 * Problem: @sentry/react-native adds two Xcode build phases (sentry-xcode.sh and
 * sentry-xcode-debug-files.sh) that call sentry-cli at build time. These scripts check the
 * SENTRY_DISABLE_AUTO_UPLOAD env var — but EAS Build env vars set in eas.json are NOT
 * propagated by fastlane into the Xcode build-phase environment.
 *
 * Fix: inject SENTRY_DISABLE_AUTO_UPLOAD=true directly into all Xcode build configurations
 * as an Xcode build setting. Build settings ARE visible to run-script build phases.
 *
 * Crash reporting via DSN still works at runtime — this only disables the CI upload step.
 */
const { withXcodeProject } = require("@expo/config-plugins");

module.exports = function withSentryDisableUpload(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();

    for (const key of Object.keys(configurations)) {
      const buildConfig = configurations[key];
      if (buildConfig && buildConfig.buildSettings) {
        buildConfig.buildSettings.SENTRY_DISABLE_AUTO_UPLOAD = "true";
      }
    }

    return config;
  });
};
