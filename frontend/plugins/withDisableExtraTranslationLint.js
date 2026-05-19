/**
 * Custom Expo config plugin — disables Android Lint's `ExtraTranslation` rule
 * during `:app:lintVitalRelease`.
 *
 * Background: Expo's `expo.locales` block in app.json generates
 * `res/values-b+<locale>/strings.xml` for every entry, including the iOS-only
 * NSx Info.plist permission keys (NSCameraUsageDescription,
 * NSPhotoLibraryUsageDescription, etc.). Android Lint's `ExtraTranslation`
 * rule checks that every translated key has a matching entry in the
 * unqualified `values/strings.xml` (the "default locale"). Since the NSx keys
 * are iOS-only and have no Android default, lintVitalRelease fails the
 * release build with 4 errors per locale.
 *
 * Adding more locale entries (e.g. an `en` entry) does NOT help — Expo
 * generates another `values-b+en/strings.xml` file, which Lint still treats
 * as a translation, not a default. There is no way to produce an unqualified
 * `values/strings.xml` via `expo.locales` alone.
 *
 * This plugin injects `lint { disable 'ExtraTranslation' }` into
 * `android/app/build.gradle`. The rule is suppressed only for ExtraTranslation;
 * all other lint checks continue to run in vital-release mode.
 *
 * Discovered 2026-05-19: v1.0.33 EAS Android builds 21 and 22 both errored at
 * lintVitalRelease with ExtraTranslation on the DE/PL (and accidentally EN)
 * NSx string keys. See feedback_expo_locales_android_lint.md memory.
 */
const { withAppBuildGradle } = require("@expo/config-plugins");

const LINT_BLOCK = `    lint {
        disable 'ExtraTranslation'
    }`;

const LINT_MARKER = "disable 'ExtraTranslation'";

module.exports = function withDisableExtraTranslationLint(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes(LINT_MARKER)) {
      return config;
    }

    const androidBlockMatch = contents.match(/^android \{/m);
    if (!androidBlockMatch) {
      throw new Error(
        "withDisableExtraTranslationLint: could not find `android {` block in app/build.gradle"
      );
    }

    const insertAt = androidBlockMatch.index + androidBlockMatch[0].length;
    contents =
      contents.slice(0, insertAt) +
      "\n" +
      LINT_BLOCK +
      contents.slice(insertAt);

    config.modResults.contents = contents;
    return config;
  });
};
