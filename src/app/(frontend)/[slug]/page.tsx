import type { Metadata } from 'next'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import { draftMode } from 'next/headers'
import path from 'node:path'
import React, { cache } from 'react'

import { RenderSections } from '@/engine/render/RenderSections'
import { getHomeFallback } from '@/engine/seed/fallback'
import { manifest } from '@/generated/sections/manifest'
import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/LivePreviewListener'

type PageDoc = RequiredDataFromCollectionSlug<'pages'>

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const pages = await payload.find({
    collection: 'pages',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const params = pages.docs
    ?.filter((doc) => {
      return doc.slug !== 'home'
    })
    .map(({ slug }) => {
      return { slug }
    })

  return params
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = 'home' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/' + decodedSlug
  let page: PageDoc | null

  page = await queryPageBySlug({
    slug: decodedSlug,
  })

  // An unseeded database shows the home page of templates/seed/pages.yaml, read from the seed files.
  if (!page && slug === 'home') {
    page = await homeFallback()
  }

  if (!page) {
    return <PayloadRedirects url={url} />
  }

  const { layout } = page

  return (
    <article>
      <PageClient />
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <RenderSections blocks={layout} />
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = 'home' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const page = await queryPageBySlug({
    slug: decodedSlug,
  })

  return generateMeta({ doc: page })
}

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    depth: 2,
    draft,
    limit: 1,
    pagination: false,
    overrideAccess: draft,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})

const homeFallback = cache(async (): Promise<PageDoc | null> => {
  const layout = await getHomeFallback(path.resolve(process.cwd(), 'templates'), manifest)
  if (layout.length === 0) return null
  // Rows come from seed/pages.yaml, whose values the seeder checks against the section fields.
  return { title: 'Home', slug: 'home', layout: layout as unknown as PageDoc['layout'] }
})
