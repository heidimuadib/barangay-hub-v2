import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * US-UI-001 — the accent palettes, validated rather than asserted.
 *
 * This parses `globals.css` ITSELF. It does not compare against a fixture copy
 * of the values, because a fixture drifts: someone edits the stylesheet, the
 * test keeps checking the old numbers, and an unvalidated palette ships while
 * the suite stays green. The stylesheet is the input.
 *
 * Two properties, both from Phase 6 §4.9 / P6-C-D:
 *
 *   1. every accent's TEXT shade clears WCAG AA on white — and in fact AAA,
 *      because these are used for links and headings at ordinary weight;
 *   2. no two accents are so close that two barangays look like one brand.
 *
 * The locked semantic colours are checked too. A tenant cannot change them,
 * which is exactly why a regression in one would be silent.
 */

// Resolved from the package root rather than `import.meta.url`: the jsdom
// environment does not give this module a `file:` URL.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8')

// ── Colour maths (sRGB → relative luminance → WCAG ratio; sRGB → CIE Lab) ───

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number]
}

function linearise(byte: number): number {
  const v = byte / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linearise) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ]
  return (hi + 0.05) / (lo + 0.05)
}

function toLab(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map(linearise) as [number, number, number]
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** CIE76. Coarse, but far above the ~2.3 just-noticeable difference. */
function colourDistance(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a)
  const [l2, a2, b2] = toLab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

// ── Extraction ──────────────────────────────────────────────────────────────

const WHITE = '#ffffff'

/** The default ramp lives in `@theme`; the rest in `[data-accent='…']`. */
function accentTextShades(): ReadonlyMap<string, string> {
  const found = new Map<string, string>()

  const theDefault = /--color-brand-700:\s*(#[0-9a-f]{6})/i.exec(CSS)
  if (theDefault?.[1]) found.set('teal (default)', theDefault[1])

  const block = /\[data-accent='([a-z]+)'\]\s*\{([^}]*)\}/gi
  let match: RegExpExecArray | null
  while ((match = block.exec(CSS)) !== null) {
    const name = match[1]
    const shade = /--color-brand-700:\s*(#[0-9a-f]{6})/i.exec(match[2] ?? '')
    if (name && shade?.[1]) found.set(name, shade[1])
  }
  return found
}

function semanticTextShades(): ReadonlyMap<string, string> {
  const found = new Map<string, string>()
  const pattern = /--color-(success|warning|danger|info|neutral)-(\d{3}):\s*(#[0-9a-f]{6})/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(CSS)) !== null) {
    // 700 is the text shade throughout; neutral-500 is the documented minimum
    // for body text and is checked with it.
    if (match[2] === '700' || (match[1] === 'neutral' && match[2] === '500')) {
      found.set(`${match[1]}-${match[2]}`, match[3] as string)
    }
  }
  return found
}

const accents = accentTextShades()
const semantics = semanticTextShades()

describe('US-UI-001 — the palettes exist and were parsed', () => {
  it('finds the default plus seven curated accents', () => {
    // If this drops, the stylesheet changed shape and every assertion below
    // would be vacuously passing over an empty set.
    expect(accents.size).toBe(8)
    expect([...accents.keys()]).toContain('teal (default)')
  })

  it('finds the locked semantic text shades', () => {
    expect(semantics.size).toBeGreaterThanOrEqual(5)
  })
})

describe('US-UI-001 — contrast', () => {
  it.each([...accents.entries()])('accent %s clears AAA on white', (name, hex) => {
    const ratio = contrastRatio(hex, WHITE)
    expect(ratio, `${name} (${hex}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(7)
  })

  it.each([...semantics.entries()])('semantic %s clears AA on white', (name, hex) => {
    const ratio = contrastRatio(hex, WHITE)
    expect(ratio, `${name} (${hex}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
  })

  it('never uses neutral-400 as a text colour — it is decorative only', () => {
    const decorative = /--color-neutral-400:\s*(#[0-9a-f]{6})/i.exec(CSS)?.[1]
    expect(decorative).toBeDefined()
    // Asserted as a FAILURE: this documents why the token is marked
    // decorative, so nobody "fixes" the comment by using it for text.
    expect(contrastRatio(decorative as string, WHITE)).toBeLessThan(4.5)
  })
})

describe('US-UI-001 — colour distance', () => {
  /**
   * ΔE ≥ 15, not the 20 first attempted.
   *
   * Every accent must also clear 7:1 on white, which confines all eight to the
   * dark end of the space and caps how far apart they can get: the closest
   * admissible pair across several candidate sets was ~18. Choosing 15 states
   * the real constraint instead of quietly relaxing the contrast requirement,
   * which is the one that actually serves users. It remains ~6× the just-
   * noticeable difference.
   */
  const MINIMUM_DISTANCE = 15

  it('keeps every pair of accents visibly distinct', () => {
    const entries = [...accents.entries()]
    const tooClose: string[] = []

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [nameA, hexA] = entries[i] as [string, string]
        const [nameB, hexB] = entries[j] as [string, string]
        const distance = colourDistance(hexA, hexB)
        if (distance < MINIMUM_DISTANCE) {
          tooClose.push(`${nameA} vs ${nameB}: ΔE ${distance.toFixed(1)}`)
        }
      }
    }

    expect(tooClose).toEqual([])
  })

  it('keeps every accent distinct from the danger colour', () => {
    // An accent that reads as the rejection colour would make a barangay's own
    // branding look like an error state.
    const danger = semantics.get('danger-700')
    expect(danger).toBeDefined()

    for (const [name, hex] of accents) {
      const distance = colourDistance(hex, danger as string)
      expect(distance, `${name} is ΔE ${distance.toFixed(1)} from danger`).toBeGreaterThanOrEqual(
        MINIMUM_DISTANCE,
      )
    }
  })
})
