# OMH Sections Generator

Take-home coding assignment for an engineering role at **OMH Services**: build a small version of a **Sections Generator / Compiler** on top of the [Payload website template](https://github.com/payloadcms/payload/tree/main/templates/website).

## Context

OMH Services is a Berlin digital agency. The idea behind the Sections Generator is that a website's sections are described in config, not hand-written as components.

## The problem

In the stock Payload website template, every hero, block and section is a hand-written TypeScript config plus a React component. Adding a new hero, form or section means writing new TS/TSX files and rebuilding.

The goal is to make the face of the site **config-driven**:

- Each section is described by a template file (YAML or JSON) in `templates/`.
- A compiler reads those templates and turns them into working sections: the Payload fields the editor fills in, and the markup that renders them.
- Adding, reordering, restyling or rebranding a section means editing a template file, not writing a new component.

In short, a small website builder whose source of truth is a set of section templates.

## Reference template

The brief included this example, quoted here as given. The brief says it can be replaced by whatever format and syntax gives the best developer experience.

```yml
- content: heading
- content: description
- button: primaryButton
- button: secondaryButton
- image: backgroundImage

- array:
- name: bullets
- icon: bullet-icon
- content: bullet-content

- div: flex flex-col gap-4
- content: heading
- content: description
- array:bullets div flex flex-col gap-2
- icon: bullet-icon
- content: bullet-content
- div: flex flex-row gap-4
- button: primaryButton
- button: secondaryButton
```

What the example shows:

| Element | Meaning |
| --- | --- |
| `content: <name>` | A text field the editor fills in |
| `button: <name>` | A link or button (label + destination) |
| `image: <name>` | A media field |
| `icon: <name>` | An icon field |
| `array: <name>` | A repeatable group of fields (for example a bullet list) |
| `div: <classes>` | A layout wrapper with Tailwind classes, nesting the elements under it |

The example appears to describe two things: the **data** a section needs (the first two groups) and its **layout** (the `div` tree). In the flat list as written, nesting is implied rather than expressed, and that is one of the things the final format has to fix.

## What needs to be done

1. **Template format.** Settle on a syntax (YAML or JSON) that declares a section's fields, its layout and its styling clearly, including nesting and repeatable groups. Validate it, with readable errors.
2. **Multiple templates.** Support any number of templates (`template-1`, `template-2`, …), each in its own file under `templates/`.
3. **Compiler.** Read the templates and generate what Payload needs: block or field configs for the admin, and TypeScript types.
4. **Renderer.** Render any compiled section on the frontend from its template, with no per-section component.
5. **Payload integration.** Editors pick a section template in the admin, fill in its content and place or reorder it on a page; the site renders it.
6. **Proof.** A few example templates (for example a hero, a feature list and a call to action) built only from config, and seeded so they show on a page.

## Constraints

- Any stack for the compiler and any tooling for development.
- TypeScript, and output that stays lean: no unused data or markup.
- Every line is reviewed and tested by hand before it ships.
- The brief is deliberately loose. Decisions and trade-offs should be stated and justified.

## Status

- Base: Payload website template, from `payloadcms/payload` `main` at `b103a85`.
- The template's `package.json` still points the Payload packages at `workspace:*` and has to be pinned to published versions before it installs.
- Approach and plan: [docs/spec/README.md](spec/README.md); the brief's hero in the final format is in [demo-templates.md section 4](spec/demo-templates.md#4-the-briefs-hero-in-the-final-format).
