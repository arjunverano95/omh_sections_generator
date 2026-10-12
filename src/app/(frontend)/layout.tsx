import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { RenderGlobal } from '@/engine/render/RenderGlobal'
import { fontVariables } from '@/generated/sections/fonts'
import { manifest } from '@/generated/sections/manifest'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './globals.css'
// The theme's tokens: fonts, colours and radius, over the defaults in globals.css.
import '@/generated/sections/theme.css'
import { getServerSideURL } from '@/utilities/getURL'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()

  return (
    <html className={cn(fontVariables, GeistMono.variable)} lang="en" suppressHydrationWarning>
      <head>
        <InitTheme colorMode={manifest.colorMode} />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <Providers colorMode={manifest.colorMode}>
          <AdminBar
            adminBarProps={{
              preview: isEnabled,
            }}
          />

          <RenderGlobal slug="header" />
          {children}
          <RenderGlobal slug="footer" />
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@payloadcms',
  },
}
