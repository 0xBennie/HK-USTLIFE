import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { migrate } = require('../apps/mobile/plugins/with-ios-scene.cjs');

const delegate = `internal import Expo
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?
  func launch() {
    reactNativeFactory = factory
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
  }
  // Existing linking hooks must survive migration.
  func handleLink() { RCTLinkingManager.application(app, open: url, options: options) }
}`;

describe('iOS 27 scene migration', () => {
  it('hands startup to Expo scene runtime without removing the factory or linking hooks', () => {
    const result = migrate(delegate);
    expect(result).toContain('ExpoReactNativeFactoryProvider');
    expect(result).toContain('reactNativeFactory = factory');
    expect(result).toContain('RCTLinkingManager.application(app, open: url, options: options)');
    expect(result).not.toContain('factory.startReactNative(');
    expect(result).not.toContain('UIWindow(frame:');
    expect(migrate(result)).toBe(result);
  });
  it('refuses a changed startup block instead of silently dropping custom initialization', () => {
    expect(() => migrate(delegate.replace('withModuleName: "main"', 'withModuleName: "custom"'))).toThrow(/unexpected AppDelegate/);
    expect(() => migrate(delegate.replace('ExpoAppDelegate {', 'OtherDelegate {'))).toThrow(/unexpected AppDelegate/);
  });
});
