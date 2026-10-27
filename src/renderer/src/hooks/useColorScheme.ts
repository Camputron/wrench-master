import { useEffect } from 'react'

/**
 * Applies HeroUI's light or dark theme to match `prefers-color-scheme`. The main process sets
 * `nativeTheme.themeSource` from the user's theme setting, and Chromium reports it here.
 */
export function useColorScheme(): void {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const scheme = query.matches ? 'dark' : 'light'
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(scheme)
      root.dataset.theme = scheme
      root.style.colorScheme = scheme
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])
}
