/**
 * Custom Expo config plugin — controls whether Sentry source-map / debug-symbol
 * upload runs during EAS iOS builds.
 *
 * Background: @sentry/react-native adds two Xcode build phases (sentry-xcode.sh
 * and sentry-xcode-debug-files.sh) that call sentry-cli at build time. They
 * check the SENTRY_DISABLE_AUTO_UPLOAD env var — but EAS Build env vars set in
 * eas.json are NOT propagated by fastlane into the Xcode build-phase
 * environment. So we inject SENTRY_DISABLE_AUTO_UPLOAD directly as an Xcode
 * build setting, which IS visible to run-script build phases.
 *
 * Behaviour (#17 — crash-debugging readiness):
 *   - Default (no env var set): inject SENTRY_DISABLE_AUTO_UPLOAD=true → uploads skipped.
 *   - When ENABLE_SENTRY_UPLOAD=true is set on EAS (eas.json env block): do NOT
 *     inject the disable flag → sentry-cli runs during the build and uploads
 *     source maps + dSYMs to Sentry. Requires SENTRY_AUTH_TOKEN to also be set
 *     as an EAS Secret (`eas secret:create --scope project --name SENTRY_AUTH_TOKEN
 *     --value <token>`); without the token sentry-cli warns and skips the
 *     upload but the build still succeeds.
 *
 * Crash reporting via DSN works at runtime regardless — this only controls
 * the CI-side artifact upload step that makes Sentry stack traces readable.
 */
const { withXcodeProject } = require("@expo/config-plugins");

module.exports = function withSentryDisableUpload(config) {
  // Opt-in flag — when set on EAS, leave Xcode build settings alone so the
  // standard sentry-xcode.sh upload runs. Default is to disable (current behaviour).
  const uploadEnabled = process.env.ENABLE_SENTRY_UPLOAD === "true";
  if (uploadEnabled) {
    return config;
  }

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
