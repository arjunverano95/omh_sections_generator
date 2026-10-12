import { test, expect, Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'yaml'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL = 'http://localhost:3000'
const seedDir = path.resolve(dirname, '../../templates/seed')

type SeedSection = Record<string, Record<string, unknown>>
type SeedPage = { slug: string; title: string; sections: SeedSection[] }
type SeedFormField = { blockType: string; name: string; label?: string; required?: boolean }
type SeedForm = {
  key: string
  submitButtonLabel?: string
  confirmationMessage?: string
  fields: SeedFormField[]
}

function readSeed<T>(file: string): T {
  return parse(fs.readFileSync(path.join(seedDir, file), 'utf8')) as T
}

/** The data of every section on a seeded page, in page order. */
function sectionData(page: SeedPage): Record<string, unknown>[] {
  return page.sections.map((section) => Object.values(section)[0] ?? {})
}

/** A plausible value for a form-builder field, by its block type. */
function sampleValue(field: SeedFormField): string {
  switch (field.blockType) {
    case 'email':
      return 'e2e@example.com'
    case 'number':
      return '1'
    case 'textarea':
      return 'Sent by the sections end-to-end test.'
    default:
      return 'E2E'
  }
}

const pages = readSeed<SeedPage[]>('pages.yaml')
const forms = readSeed<SeedForm[]>('forms.yaml')

const home = pages.find((p) => p.slug === 'home')
if (!home) throw new Error('templates/seed/pages.yaml has no page with slug "home"')

const heroHeading = sectionData(home).find((data) => typeof data.heading === 'string')?.heading
if (typeof heroHeading !== 'string') {
  throw new Error('no section on the home page has a heading')
}

const formKey = sectionData(home)
  .map((data) => data.form)
  .find((value): value is string => typeof value === 'string' && value.startsWith('@form/'))
  ?.slice('@form/'.length)
const form = forms.find((f) => f.key === formKey)
if (!form) throw new Error('no form on the home page found in templates/seed/forms.yaml')

test.describe('Sections', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(3 * 60 * 1000)
    await seedTestUser()

    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })

    const response = await page.request.post(`${serverURL}/next/seed`, { timeout: 2 * 60 * 1000 })
    expect(response.ok()).toBe(true)
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('renders the hero heading from the seed', async () => {
    await page.goto(serverURL)
    await expect(page.locator('h1').first()).toHaveText(heroHeading)
  })

  test('renders the header and footer globals', async () => {
    await page.goto(serverURL)
    const header = page.locator('header').first()
    const footer = page.locator('footer').last()
    await expect(header).toBeVisible()
    await expect(header.getByRole('link').first()).toBeVisible()
    await expect(footer).toBeVisible()
    await expect(footer.getByRole('link').first()).toBeVisible()
  })

  test('submits the form and shows the confirmation', async () => {
    await page.goto(serverURL)
    const formElement = page.locator('form').filter({
      has: page.locator(`[name="${form.fields[0]?.name}"]`),
    })
    await formElement.scrollIntoViewIfNeeded()

    for (const field of form.fields) {
      if (field.blockType === 'checkbox') {
        if (field.required) await formElement.locator(`[name="${field.name}"]`).check()
        continue
      }
      if (field.blockType === 'select' || field.blockType === 'message') continue
      await formElement.locator(`[name="${field.name}"]`).fill(sampleValue(field))
    }

    const submit = form.submitButtonLabel
      ? formElement.getByRole('button', { name: form.submitButtonLabel })
      : formElement.locator('button[type="submit"]')
    await submit.click()

    if (form.confirmationMessage) {
      await expect(page.getByText(form.confirmationMessage)).toBeVisible()
    }
  })
})
