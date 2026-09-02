import { invoke as tauriInvoke, isTauri } from '@tauri-apps/api/core';

export { isTauri };

const BROWSER_MESSAGE =
  'Latte must run as a desktop app. Start it with `yarn tauri dev` — do not use `yarn dev` in a browser.';

export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauri()) {
    throw new Error(BROWSER_MESSAGE);
  }
  return tauriInvoke<T>(cmd, args);
}

export const browserModeMessage = BROWSER_MESSAGE;
