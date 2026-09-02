import { ref, type Ref } from 'vue'

export type ThemePreference = 'light' | 'dark' | 'system'

export interface AppSettings {
  theme: ThemePreference
  autoSave: boolean
  editorFontSize: number
  showLineNumbers: boolean
}

const SETTINGS_KEY = 'latte-app-settings'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  autoSave: true,
  editorFontSize: 14,
  showLineNumbers: true,
}

let mediaQuery: MediaQueryList | null = null
let mediaHandler: ((event: MediaQueryListEvent) => void) | null = null
let currentPreference: ThemePreference = 'system'

/** Reactive resolved theme used by the UI / editor. */
export const resolvedTheme: Ref<'light' | 'dark'> = ref('light')

export function loadSettings(): AppSettings {
  const stored = localStorage.getItem(SETTINGS_KEY)
  if (!stored) return { ...DEFAULT_SETTINGS }

  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function getResolvedTheme(theme: ThemePreference): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: ThemePreference) {
  currentPreference = theme
  const resolved = getResolvedTheme(theme)
  resolvedTheme.value = resolved
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function startThemeListener() {
  stopThemeListener()
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaHandler = () => {
    if (currentPreference === 'system') applyTheme('system')
  }
  mediaQuery.addEventListener('change', mediaHandler)
}

export function stopThemeListener() {
  if (mediaQuery && mediaHandler) {
    mediaQuery.removeEventListener('change', mediaHandler)
  }
  mediaQuery = null
  mediaHandler = null
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...loadSettings(), ...partial }
  saveSettings(next)
  if (partial.theme !== undefined) {
    applyTheme(next.theme)
  }
  return next
}
