# Apply after pod install. Only patch the known EXConstants shell invocation.
require 'xcodeproj'
project_path = File.expand_path('../apps/mobile/ios/Pods/Pods.xcodeproj', __dir__)
abort "Missing generated Pods project: #{project_path}" unless File.directory?(project_path)
project = Xcodeproj::Project.open(project_path)
old_script = 'bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"'
new_script = 'bash -l "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"'
phases = project.targets.select { |t| t.name == 'EXConstants' }.flat_map(&:shell_script_build_phases).select { |p| p.name.include?('Generate app.config') }
abort 'Expected exactly one EXConstants config phase; inspect the generated project.' unless phases.length == 1
phase = phases.first
if phase.shell_script.strip == new_script
  puts 'EXConstants path quoting already fixed.'
elsif phase.shell_script.strip == old_script
  phase.shell_script = new_script
  project.save
  puts 'Fixed EXConstants path quoting in task-local Pods project.'
else
  abort 'Unexpected EXConstants script; refusing to replace changed upstream behavior.'
end
app_path = File.expand_path('../apps/mobile/ios/Campus.xcodeproj', __dir__)
app_project = Xcodeproj::Project.open(app_path)
bundle_phases = app_project.targets.select { |t| t.name == 'Campus' }.flat_map(&:shell_script_build_phases).select { |p| p.name == 'Bundle React Native code and images' }
abort 'Expected one Campus bundle phase.' unless bundle_phases.length == 1
old_line = <<~'SH'
`"$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'"`
SH
new_line = <<~'SH'
RN_XCODE_SCRIPT="$("$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'")"
/bin/bash "$RN_XCODE_SCRIPT"
SH
bundle_phase = bundle_phases.first
if bundle_phase.shell_script.include?(new_line)
  puts 'Campus bundle path quoting already fixed.'
elsif bundle_phase.shell_script.scan(old_line).length == 1
  bundle_phase.shell_script = bundle_phase.shell_script.sub(old_line, new_line)
  app_project.save
  puts 'Fixed Campus bundle script path quoting.'
else
  abort 'Unexpected Campus bundle script; inspect upstream behavior.'
end
