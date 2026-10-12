import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'

/** `afterChange` for a generated global: revalidates the `global_<slug>` tag `getCachedGlobal` sets. */
export const revalidateGlobal =
  (slug: string): GlobalAfterChangeHook =>
  ({ doc, req: { payload, context } }) => {
    if (!context.disableRevalidate) {
      payload.logger.info(`Revalidating ${slug}`)

      revalidateTag(`global_${slug}`, 'max')
    }

    return doc
  }
