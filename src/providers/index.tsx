import React from 'react'

import type { ColorMode } from '@/engine/manifest'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'

export const Providers: React.FC<{
  children: React.ReactNode
  colorMode: ColorMode
}> = ({ children, colorMode }) => {
  return (
    <ThemeProvider colorMode={colorMode}>
      <HeaderThemeProvider>{children}</HeaderThemeProvider>
    </ThemeProvider>
  )
}
