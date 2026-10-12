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

**Theme.** `siteName: Studio`. `Inter` for text, `Playfair Display` for headings. Warm white background, near-black ink, deep blue primary, a soft `0.5rem` radius. A dark set is provided so the theme selector works. Variants: `heading.display`, `heading.section`, `text.lead`, `text.eyebrow`, `text.badge` (a rounded pill), `card.plan` and `card.planHighlighted` (rounded cards with a soft shadow, the highlighted one with a primary border), `button.primary`, `button.ghost`, `button.link`.

**Header.** `logo` (image, required), `navItems` (array of `link`, max 6, rowLabel `link`), `cta` (link, optional, `if: cta`).

**Footer.** `columns` (array, max 4, rowLabel `heading`: `heading` text, `links` array of `link`), `note` (textarea), `social` (array, rowLabel `icon`: `icon`, `link`).

**Sections**

| Section | Fields | Layout |
| --- | --- | --- |
| **Heroes** | | |
| `hero-split` | `eyebrow` text · `heading` text required · `description` textarea · `primaryButton` link · `secondaryButton` link · `image` image | two-column grid; copy and buttons left, image right under `if: image` |
| `hero-centered` | `badge` text · `heading` text required · `description` textarea · `primaryButton` link · `secondaryButton` link · `backgroundImage` image · `bullets` array max 4, rowLabel `text` (`icon` icon · `text` text) | centred column over a faint full-bleed background image (`if: backgroundImage`): badge pill, display heading, lead, icon bullets in a row, primary and ghost buttons |
| `hero-cover` | `eyebrow` text · `heading` text required · `description` textarea · `button` link · `image` image required | full-bleed section, min 70vh; the image fills it absolutely; a bottom-up dark gradient overlay holds the copy, set in white at the bottom left, button under `if: button` |
| `hero-simple` | `eyebrow` text · `heading` text required · `description` textarea | no image; eyebrow, display heading and lead in a `max-w-3xl` column; for inner pages |
| **Content** | | |
| `features` | `heading` text · `intro` textarea · `columns` select `2`/`3`/`4` · `items` array (`icon` icon · `title` text · `text` textarea) | heading, intro, then one grid per `columns` value chosen with `if: { field: columns, equals: n }` |
| `feature-rows` | `rows` array, min 1, max 6 (`title` text required · `body` richText · `image` image required · `reverse` checkbox) | one two-column article per row; copy left and image right, or image left from `md` when `reverse` is ticked (two articles under `if: { field: reverse, not: true }` and `equals: true`); copy comes first on small screens |
| `stats` | `heading` text · `intro` textarea · `items` array, min 2, max 4, rowLabel `label` (`value` text required · `label` text required) | heading and intro, then a two-column (four from `md`) list; each figure large in the heading font in the primary colour, label under it, a hairline rule on the left |
| `faq` | `heading` text · `intro` textarea · `items` array, min 1, max 12, rowLabel `question` (`question` text required · `answer` richText required) | heading and intro left, questions right; each item a `details` with the question as its `summary` (a + that turns to − when open) and the answer as rich text |
| **Social proof** | | |
| `testimonial` | `quote` richText required · `name` text · `role` text · `avatar` image | centred quote with an avatar row |
| `logo-strip` | `heading` text · `logos` array, min 1, max 8 (`image` image required · `name` text required, the screen-reader label) | eyebrow heading over one wrapped line of greyscale logos that turn to colour on hover |
| `team` | `heading` text · `intro` textarea · `members` array, max 8, rowLabel `name` (`photo` image · `name` text required · `role` text) | heading and intro, then a two-column (four from `md`) grid of square photos with name and role under each; photo under `if: photo` |
| **Conversion** | | |
| `contact` | `heading` text · `text` textarea · `form` form required | heading and copy left, form right |
| `pricing` | `heading` text · `plans` array, min 1, max 3 (`name` text required · `price` number required, min 0 · `period` select `month`/`year` · `features` array max 8 of `text` · `button` link · `highlighted` checkbox) | up to three cards in a grid; `card.planHighlighted` with a primary button when `highlighted` is ticked (`if: { field: highlighted, equals: true }`), else `card.plan` with a ghost button (`not: true`); `$`, price and period; features as a bordered list |
| `cta-band` | `heading` text required · `text` textarea · `button` link | full-width primary-colour band; heading and copy left, an inverted button right |
| `newsletter` | `heading` text · `text` textarea · `form` form required | centred heading and lead over a narrow form |
| **Blog** | | |
| `latest-posts` | `heading` text · `category` relation to `categories` · `allPostsLink` link | `list` over posts, limit 3, `-publishedAt`, `where: { categories: { in: { field: category } } }`; each card: `meta.image`, `title`, `publishedAt`, `button: { label: Read, href: url }` |

## 3. The seed

`templates/seed/` holds the content the seed button writes.

**Pages** (`pages.yaml`):

- **Home** (slug `home`): `hero-split`, `features` (three columns), `latest-posts`, `testimonial`, `contact`.
- **Services** (slug `services`): `hero-centered` (badge, three bullets, background image), `logo-strip` (six clients), `feature-rows` (three "how we work" rows, the middle one reversed), `pricing` (Sprint, Retainer highlighted, Partner yearly), `cta-band`, `newsletter`.
- **About** (slug `about`): `hero-cover`, `stats` (four figures: years, projects, people, cities), `team` (four members), `faq` (five questions), `testimonial` (a second quote).
- **Contact** (slug `contact`): `hero-simple`, `contact`.

**Globals** (`globals.yaml`): the header nav is Work, Services, About, Journal, Contact, with a CTA; the footer's Studio column links Work, Services, About and Contact, beside the note and the social icons.

**Forms** (`forms.yaml`): Contact (name, email, message) and Newsletter (email).

**Media** (`media.yaml` and `media/`): the logo, the home hero image, an avatar, the About cover image, four square team portraits, the Services background, six client logos and three how-we-work images. `media.yaml` gives each file its alt text; a file it does not list gets an alt derived from its name.

The demo posts the `latest-posts` section lists are seeded by the engine from `src/engine/seed/`, since posts are not sections.

## 4. The brief's hero, in the final format

The brief's example describes a hero with a heading, a description, two buttons, a background image and icon bullets. In this format it is `templates/sections/hero-centered.yaml`:

```yaml
# yaml-language-server: $schema=../schema.json
name: hero-centered
label: Centered hero
plural: Centered heroes
description: A badge, a headline, copy, icon bullets and two buttons, centred over an optional background image.
group: Heroes

fields:
  badge: text
  heading:
    type: text
    required: true
  description: textarea
  primaryButton: link
  secondaryButton: link
  backgroundImage:
    type: image
    help: Optional. Shown faintly behind the copy.
  bullets:
    type: array
    max: 4
    rowLabel: text
    fields:
      icon: icon
      text: text

layout:
  - div: relative flex min-h-[70vh] items-center overflow-hidden
    as: section
    children:
      - image: backgroundImage
        class: absolute inset-0 h-full w-full object-cover opacity-20
        priority: true
        if: backgroundImage
      - div: container relative flex flex-col items-center gap-6 py-20 text-center md:py-28
        children:
          - text: badge
            as: span
            variant: text.badge
            if: badge
          - text: heading
            as: h1
            variant: heading.display
            class: max-w-4xl
          - text: description
            variant: text.lead
            class: max-w-2xl
            if: description
          - each: bullets
            as: ul
            class: flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm
            children:
              - div: flex items-center gap-2
                as: li
                children:
                  - icon: icon
                    class: text-primary
                  - text: text
                    as: span
          - div: flex flex-wrap justify-center gap-3 pt-2
            children:
              - button: primaryButton
                variant: button.primary
                if: primaryButton
              - button: secondaryButton
                variant: button.ghost
                if: secondaryButton
```

Set against the brief's flat list: fields and layout are two explicit halves; nesting is real indentation rather than implied by order; the brief's `bullet-icon` and `bullet-content` are `icon` and `text` inside the row, because they belong to the row and because hyphens are not valid field names; the brief's `array:bullets div flex ...` is `each: bullets` with its own `as` and `class`; the two buttons are the same `link` field type with different variants.

## 5. What the site does not try to show

- A blog layout. Posts keep the stock post page; the sections link to them.
- Arrays nested deeper than one level inside a row (the format rejects them), animations, or client-side interaction other than the forms, the FAQ disclosures and the theme selector.
- A mobile menu. The header hides the nav below `md` and relies on the footer; see the open issues in [build-plan.md](build-plan.md#open-issues).
