const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
const config = getDefaultConfig(__dirname);
// The website has a different React patch; all native imports use the mobile copy.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return { filePath: require.resolve(moduleName, { paths: [__dirname] }), type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = withUniwindConfig(config, { cssEntryFile: './global.css', dtsFile: './src/uniwind-types.d.ts' });
