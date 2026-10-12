import Script from 'next/script'
import React from 'react'

import type { ColorMode } from '@/engine/manifest'

import { defaultTheme, themeLocalStorageKey } from '../ThemeSelector/types'

/**
 * Sets `data-theme` before the first paint. A theme with `colorMode: light` or `dark` gets
 * that palette for every visitor; `system` follows a stored choice, then the device setting.
 */
export const InitTheme: React.FC<{ colorMode: ColorMode }> = ({ colorMode }) => {
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      dangerouslySetInnerHTML={{
        __html: `
  (function () {
    function getImplicitPreference() {
      var mediaQuery = '(prefers-color-scheme: dark)'
      var mql = window.matchMedia(mediaQuery)
      var hasImplicitPreference = typeof mql.matches === 'boolean'

      if (hasImplicitPreference) {
        return mql.matches ? 'dark' : 'light'
      }

      return null
    }

    function themeIsValid(theme) {
      return theme === 'light' || theme === 'dark'
    }

    var themeToSet = '${defaultTheme}'
    var colorMode = '${colorMode}'

    if (themeIsValid(colorMode)) {
      themeToSet = colorMode
    } else {
      var preference = window.localStorage.getItem('${themeLocalStorageKey}')

      if (themeIsValid(preference)) {
        themeToSet = preference
      } else {
        var implicitPreference = getImplicitPreference()

        if (implicitPreference) {
          themeToSet = implicitPreference
        }
      }
    }

    document.documentElement.setAttribute('data-theme', themeToSet)
  })();
  `,
      }}
      id="theme-script"
      strategy="beforeInteractive"
    />
  )
}
