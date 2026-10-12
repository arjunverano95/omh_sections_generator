# Demo Site

Part of the [Sections Engine Specification](README.md). One site, "Studio", proves the engine: a theme, a header, a footer and sixteen sections in five drawer groups, seeded into four pages. Together the sections exercise every primitive, field type and option the format defines.

## 1. What the library exercises

- **Primitives:** text, richText, image, icon, button, div, each, list, form.
- **Field types:** text, textarea, richText, image, icon, link, select, number, checkbox, array, form, relation.
- **Conditions:** `if` on a bare reference, `equals` on a select, `equals` and `not` on a checkbox.
- **Data sources:** a `list` over posts with a `where` placeholder filled from a `relation` field.
- **Forms:** two form-builder forms, Contact (name, email, message) and Newsletter (email).
- **Tags:** a native disclosure from `as: details` with an `as: summary` text, with no script.
- **Admin:** drawer groups, row labels, required fields, `min` and `max` on arrays, preview images.

Everything under `templates/` is YAML and media. Zero `.ts` or `.tsx` files.

## 2. Studio

**Theme.** `siteName: Studio`. `Inter` for text, `Playfair Display` for headings. Warm white background, near-black ink, deep blue primary, a soft `0.5rem` radius. A dark set is provided so the theme selector works. Variants: `heading.display`, `heading.section`, `text.lead`, `text.eyebrow`, `button.primary`, `button.ghost`, `button.link`.

**Header.** `logo` (image, required), `navItems` (array of `link`, max 6, rowLabel `link`), `cta` (link, optional, `if: cta`).

**Footer.** `columns` (array, max 4, rowLabel `heading`: `heading` text, `links` array of `link`), `note` (textarea), `social` (array, rowLabel `icon`: `icon`, `link`).

**Sections**

| Section | Fields | Layout |
| --- | --- | --- |
| **Heroes** | | |
| `hero-split` | `eyebrow` text · `heading` text required · `description` textarea · `primaryButton` link · `secondaryButton` link · `image` image | two-column grid; copy and buttons left, image right under `if: image` |
| `hero-centered` | `eyebrow` text · `heading` text required · `description` textarea · `bullets` array max 4, rowLabel `text` (`icon` icon · `text` text) · `primaryButton` link · `secondaryButton` link · `backgroundImage` image | full-height centred stack; background image absolutely positioned behind under `if: backgroundImage`; bullets as a `ul` of icon and text |
| `hero-cover` | `eyebrow` text · `heading` text required · `description` textarea · `button` link · `image` image required | full-bleed section, min 70vh; the image fills it absolutely; a bottom-up dark gradient overlay holds the copy, set in white at the bottom left, button under `if: button` |
| `hero-simple` | `eyebrow` text · `heading` text required · `description` textarea | no image; eyebrow, display heading and lead in a `max-w-3xl` column; for inner pages |
| **Content** | | |
| `features` | `heading` text · `intro` textarea · `columns` select `2`/`3`/`4` · `items` array (`icon` icon · `title` text · `text` textarea) | heading, intro, then one grid per `columns` value chosen with `if: { field: columns, equals: n }` |
| `feature-rows` | `rows` array, rowLabel `title` (`title` text · `body` richText · `image` image · `reverse` checkbox) | each row a two-column grid; two layouts under `if: { field: reverse, equals: true }` and `if: { field: reverse, not: true }` swap the image side |
| `stats` | `heading` text · `intro` textarea · `items` array, min 2, max 4, rowLabel `label` (`value` text required · `label` text required) | heading and intro, then a two-column (four from `md`) list; each figure large in the heading font in the primary colour, label under it, a hairline rule on the left |
| `faq` | `heading` text · `intro` textarea · `items` array, min 1, max 12, rowLabel `question` (`question` text required · `answer` richText required) | heading and intro left, questions right; each item a `details` with the question as its `summary` (a + that turns to − when open) and the answer as rich text |
| **Social proof** | | |
| `testimonial` | `quote` richText required · `name` text · `role` text · `avatar` image | centred quote with an avatar row |
| `logo-strip` | `heading` text · `logos` array max 8, rowLabel `name` (`image` image · `name` text) | one line of greyscale logos |
| `team` | `heading` text · `intro` textarea · `members` array, max 8, rowLabel `name` (`photo` image · `name` text required · `role` text) | heading and intro, then a two-column (four from `md`) grid of square photos with name and role under each; photo under `if: photo` |
| **Conversion** | | |
| `contact` | `heading` text · `text` textarea · `form` form required | heading and copy left, form right |
| `pricing` | `heading` text · `plans` array, rowLabel `name` (`name` text · `price` number · `period` select `month`/`year` · `features` array with one `text` field per row · `button` link · `highlighted` checkbox) | a row of cards; the highlighted and the plain card are two `div`s chosen by `if: { field: highlighted, equals: true }` and `not: true` |
| `cta-band` | `heading` text · `text` textarea · `button` link | full-width primary band |
| `newsletter` | `heading` text · `text` textarea · `form` form required | compact centred form |
| **Blog** | | |
| `latest-posts` | `heading` text · `category` relation to `categories` · `allPostsLink` link | `list` over posts, limit 3, `-publishedAt`, `where: { categories: { in: { field: category } } }`; each card: `meta.image`, `title`, `publishedAt`, `button: { label: Read, href: url }` |

## 3. The seed

`templates/seed/` holds the content the seed button writes.

**Pages** (`pages.yaml`):

- **Home** (slug `home`): `hero-split`, `features` (three columns), `latest-posts`, `testimonial`, `contact`.
- **Services** (slug `services`): `hero-centered`, `logo-strip`, `feature-rows` (the middle row reversed), `pricing` (the middle plan highlighted), `cta-band`, `newsletter`.
- **About** (slug `about`): `hero-cover`, `stats` (four figures: years, projects, people, cities), `team` (four members), `faq` (five questions), `testimonial` (a second quote).
- **Contact** (slug `contact`): `hero-simple`, `contact`.

**Globals** (`globals.yaml`): the header nav is Work, Services, About, Journal, Contact, with a CTA; the footer's Studio column links Work, Services, About and Contact, beside the note and the social icons.

**Forms** (`forms.yaml`): Contact (name, email, message) and Newsletter (email).

**Media** (`media.yaml` and `media/`): the logo, the home hero image, an avatar, the About cover image, four square team portraits, and the images the Services sections use. `media.yaml` gives each file its alt text; a file it does not list gets an alt derived from its name.

The demo posts the `latest-posts` section lists are seeded by the engine from `src/engine/seed/`, since posts are not sections.

## 4. The brief's hero, in the final format

The brief's example describes a hero with a heading, a description, two buttons, a background image and icon bullets. In this format it is `templates/sections/hero-centered.yaml`:

```yaml
name: hero-centered
label: Centered hero
group: Heroes
fields:
  eyebrow: text
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
          - text: eyebrow
            as: span
            variant: text.eyebrow
            if: eyebrow
          - text: heading
            as: h1
            variant: heading.display
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
                variant: button.ghost
```

Set against the brief's flat list: fields and layout are two explicit halves; nesting is real indentation rather than implied by order; the brief's `bullet-icon` and `bullet-content` are `icon` and `text` inside the row, because they belong to the row and because hyphens are not valid field names; the brief's `array:bullets div flex ...` is `each: bullets` with its own `as` and `class`; the two buttons are the same `link` field type with different variants.

## 5. What the site does not try to show

- A blog layout. Posts keep the stock post page; the sections link to them.
- Arrays nested deeper than one level inside a row (the format rejects them), animations, or client-side interaction other than the forms, the FAQ disclosures and the theme selector.
- A mobile menu. The header hides the nav below `md` and relies on the footer; see the open issues in [build-plan.md](build-plan.md#open-issues).
