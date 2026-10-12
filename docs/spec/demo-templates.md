# Demo Templates

Part of the [Sections Engine Specification](README.md). Two site faces prove the engine. They differ in look, structure and section library, and together they exercise every primitive, field type and option the format defines.

## 1. Coverage

| | template-1 Studio | template-2 Launch |
| --- | --- | --- |
| Primitives | text, richText, image, icon, button, div, each, list, form | text, richText, image, icon, button, div, each, form |
| Field types | text, textarea, richText, image, icon, link, select, array, form, relation | text, textarea, richText, image, icon, link, select, number, checkbox, array, form |
| `if` | bare reference, `equals` on a select | bare reference, `equals` and `not` on a checkbox |
| `list` | posts with a `where` placeholder from a `relation` | none |
| Theme | designed for the light set, serif headings, soft radius | designed for the dark set, grotesk type, sharp radius |
| Header | logo image, nav, one CTA | wordmark text, nav, two CTAs |
| Footer | link columns, note, social icons | single row: copyright, links, social icons |
| Seeded pages | Home, Contact | Home |
| Forms | Contact (name, email, message) | Newsletter (email) |

Everything under `templates/` for both faces is YAML and media. Zero `.ts` or `.tsx` files.

## 2. template-1 "Studio"

**Theme.** `Inter` for text, `Playfair Display` for headings. Warm white background, near-black ink, deep blue primary, a soft `0.5rem` radius. A dark set is provided so the theme selector still works. Variants: `heading.display`, `heading.section`, `text.lead`, `text.eyebrow`, `button.primary`, `button.ghost`, `button.link`.

**Header.** `logo` (image, required), `navItems` (array of `link`, max 6, rowLabel `link`), `cta` (link, optional, `if: cta`).

**Footer.** `columns` (array, max 4: `heading` text, `links` array of `link`), `note` (textarea), `social` (array: `icon`, `link`).

**Sections**

| Section | Fields | Layout |
| --- | --- | --- |
| `hero-split` | `eyebrow` text · `heading` text required · `description` textarea · `primaryButton` link · `secondaryButton` link · `image` image (optional, so the Contact page can show an empty optional rendering nothing) | two-column grid; copy and buttons left, image right under `if: image` |
| `features` | `heading` text · `intro` textarea · `columns` select `2`/`3`/`4` · `items` array (`icon`, `title`, `text` textarea) | heading, intro, then one grid per `columns` value chosen with `if: { field: columns, equals: n }` |
| `latest-posts` | `heading` text · `category` relation to `categories` · `allPostsLink` link | `list` over posts, limit 3, `-publishedAt`, `where: { categories: { in: { field: category } } }`; each card: `meta.image`, `title`, `publishedAt`, `button: { label: Read, href: url }` |
| `testimonial` | `quote` richText required · `name` text · `role` text · `avatar` image | centred quote with an avatar row |
| `contact` | `heading` text · `text` textarea · `form` form required | heading and copy left, form right |

**Seed.** Home: `hero-split`, `features` (three columns), `latest-posts`, `testimonial`, `contact`. Contact: `hero-split` without image (demonstrates an empty optional rendering nothing), `contact`. Media: logo, hero image, avatar, three post images. Form: Contact.

## 3. template-2 "Launch"

**Theme.** `Space Grotesk` for everything. The dark set is the designed look: near-black background, off-white text, electric lime primary, `0.25rem` radius. A proper light set is provided too. Which set a visitor sees first is the stock template's behaviour (their saved choice, else their system preference); a theme file does not pick a default mode, see the open issue in [build-plan.md](build-plan.md#open-issues). Variants: `heading.hero`, `heading.section`, `text.lead`, `text.badge`, `button.primary`, `button.secondary`, `button.link`, `card.plan`, `card.planHighlighted`.

**Header.** `wordmark` (text, required), `navItems` (array of `link`, max 5), `primaryCta` link, `secondaryCta` link.

**Footer.** `copyright` (text), `links` (array of `link`), `social` (array: `icon`, `link`).

**Sections**

| Section | Fields | Layout |
| --- | --- | --- |
| `hero-centered` | `badge` text · `heading` text required · `description` textarea · `bullets` array (`icon`, `text`) max 4 · `primaryButton` link · `secondaryButton` link · `backgroundImage` image | full-height centred stack; background image absolutely positioned behind, `if: backgroundImage`; bullets as a `ul` of icon + text |
| `logo-strip` | `heading` text · `logos` array (`image`, `name` text) max 8 | one line of greyscale logos |
| `feature-rows` | `rows` array (`title` text, `body` richText, `image` image, `reverse` checkbox) | each row a two-column grid; two layouts under `if: { field: reverse, equals: true }` and `if: { field: reverse, not: true }` to swap the image side |
| `pricing` | `heading` text · `plans` array (`name` text, `price` number, `period` select `month`/`year`, `features` array with one `text` field per row, `button` link, `highlighted` checkbox) | three cards; two card `div`s with `variant: card.plan` and `variant: card.planHighlighted`, chosen by `if: { field: highlighted, equals: true }` and `not: true` |
| `cta-band` | `heading` text · `text` textarea · `button` link | full-width primary band |
| `newsletter` | `heading` text · `text` textarea · `form` form required | compact centred form |

**Seed.** Home: `hero-centered`, `logo-strip`, `feature-rows` (three rows, middle one reversed), `pricing` (three plans, middle one highlighted), `cta-band`, `newsletter`. Media: six logos, three feature images, a background image. Form: Newsletter.

## 4. The brief's hero, in the final format

The brief's example describes a hero with a heading, a description, two buttons, a background image and icon bullets. In this format it is `template-2/sections/hero-centered.yaml`:

```yaml
name: hero-centered
label: Centered hero
fields:
  badge: text
  heading:
    type: text
    required: true
  description: textarea
  primaryButton: link
  secondaryButton: link
  backgroundImage: image
  bullets:
    type: array
    max: 4
    rowLabel: text
    fields:
      icon: icon
      text: text

layout:
  - div: relative flex min-h-[80vh] items-center overflow-hidden
    as: section
    children:
      - image: backgroundImage
        class: absolute inset-0 h-full w-full object-cover opacity-30
        if: backgroundImage
      - div: container relative flex flex-col items-center gap-6 text-center
        children:
          - text: badge
            as: span
            variant: text.badge
            if: badge
          - text: heading
            as: h1
            variant: heading.hero
          - text: description
            variant: text.lead
          - each: bullets
            as: ul
            class: flex flex-wrap justify-center gap-x-8 gap-y-2
            children:
              - div: flex items-center gap-2
                as: li
                children:
                  - icon: icon
                    class: text-primary
                  - text: text
                    as: span
          - div: flex flex-row gap-4
            children:
              - button: primaryButton
                variant: button.primary
              - button: secondaryButton
                variant: button.secondary
```

What changed from the brief's flat list: fields and layout are two explicit halves; nesting is real indentation instead of implied by order; `bullet-icon` and `bullet-content` became `icon` and `text` inside the row, because they belong to the row and because hyphens are not valid field names; `array:bullets div flex ...` became `each: bullets` with its own `as` and `class`; the two buttons are the same `link` field type with different variants.

## 5. What the faces do not try to show

- A blog layout. Posts keep the stock post page; the faces link to them.
- Nested arrays beyond one level, animations, or client-side interaction other than the forms and the theme selector.
- A mobile menu. Both headers hide the nav below `md` and rely on the footer; see the open issues in [build-plan.md](build-plan.md).
