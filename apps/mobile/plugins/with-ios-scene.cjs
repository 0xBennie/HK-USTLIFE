// SDK 57 opt-in for Xcode 27. Remove when upgrading to the SDK 58 template.
// https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');
const legacy = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;
const marker = '// Campus: Expo scene delegate owns window creation and React Native startup.';
function migrate(source) {
  if (source.includes('class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {') && source.includes(marker) && !source.includes('window = UIWindow(frame:')) return source;
  if (!source.includes('class AppDelegate: ExpoAppDelegate {') || !source.includes(legacy)) {
    throw new Error('Campus scene migration: unexpected AppDelegate; inspect template before changing it.');
  }
  return source.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {').replace(legacy, `    ${marker}`);
}
const manifest = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [{
      UISceneConfigurationName: 'Default Configuration',
      UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
    }],
  },
};
module.exports = function withCampusScene(config) {
  const version = require('expo/package.json').version.split('.').map(Number);
  if (version[0] !== 57 || (version[1] === 0 && version[2] < 23)) {
    throw new Error('Campus scene opt-in requires Expo 57.0.23+ on SDK 57; review before upgrading.');
  }
  config = withInfoPlist(config, mod => {
    const existing = mod.modResults.UIApplicationSceneManifest;
    if (existing && JSON.stringify(existing) !== JSON.stringify(manifest)) {
      throw new Error('Campus scene migration: refusing to replace an existing scene manifest.');
    }
    mod.modResults.UIApplicationSceneManifest = manifest;
    return mod;
  });
  return withAppDelegate(config, mod => {
    if (mod.modResults.language !== 'swift') throw new Error('Campus requires Swift AppDelegate.');
    mod.modResults.contents = migrate(mod.modResults.contents);
    return mod;
  });
};
module.exports.migrate = migrate;
