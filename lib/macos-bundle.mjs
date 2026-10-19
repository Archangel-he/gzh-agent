import { readdir, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** Bind the real Electron executable and all helper identities to Bloop before signing. */
export async function brandMacBundle(bundle) {
  const set = (plist, values) => {
    for (const [key, value] of Object.entries(values)) execFileSync('/usr/bin/plutil', ['-replace', key, '-string', value, plist]);
  };
  const frameworks = path.join(bundle, 'Contents/Frameworks');
  for (const name of await readdir(frameworks)) {
    if (!name.startsWith('DeepSeek Harness Helper') || !name.endsWith('.app')) continue;
    const executable = name.replace('DeepSeek Harness', 'Electron').slice(0, -4);
    const helper = path.join(frameworks, `${executable}.app`);
    await rename(path.join(frameworks, name), helper);
    await rename(path.join(helper, 'Contents/MacOS', name.slice(0, -4)), path.join(helper, 'Contents/MacOS', executable));
    const role = executable.match(/\((\w+)\)/)?.[1];
    set(path.join(helper, 'Contents/Info.plist'), {
      CFBundleExecutable: executable,
      CFBundleName: executable.replace('Electron', 'Bloop'),
      CFBundleDisplayName: executable.replace('Electron', 'Bloop'),
      CFBundleIdentifier: `local.gzh.design.agent.helper${role ? `.${role.toLowerCase()}` : ''}`,
    });
  }
  await rename(path.join(bundle, 'Contents/MacOS/DeepSeek Harness'), path.join(bundle, 'Contents/MacOS/Electron'));
  const plist = path.join(bundle, 'Contents/Info.plist');
  set(plist, {
    CFBundleIdentifier: 'local.gzh.design.agent', CFBundleName: 'Bloop', CFBundleDisplayName: 'Bloop', CFBundleExecutable: 'Electron',
    NSMicrophoneUsageDescription: 'Bloop 使用麦克风将语音转为对话草稿。',
    NSCameraUsageDescription: 'Bloop 在你使用相机功能时访问相机。',
    NSAudioCaptureUsageDescription: 'Bloop 在你使用音频采集功能时访问系统音频。',
    NSBluetoothAlwaysUsageDescription: 'Bloop 在你使用蓝牙设备功能时访问蓝牙。',
    NSBluetoothPeripheralUsageDescription: 'Bloop 在你使用蓝牙设备功能时访问蓝牙。',
    NSAppleEventsUsageDescription: 'Bloop 根据你的任务请求控制其他应用。',
  });
  // The vendor app.asar is removed; its integrity hash must not describe our new app directory.
  execFileSync('/usr/bin/plutil', ['-remove', 'ElectronAsarIntegrity', plist]);
  execFileSync('/usr/bin/plutil', ['-replace', 'CFBundleURLTypes.0.CFBundleURLName', '-string', 'Bloop', plist]);
}
