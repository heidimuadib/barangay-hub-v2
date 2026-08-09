import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ICON_NAMES, Icon, type IconName } from '@/components/ui'

/**
 * UI-A — the icon set's accessibility contract.
 *
 * Two failure modes, opposite and equally bad: a decorative glyph that announces
 * itself ("image, chevron right" between every breadcrumb), and a meaningful
 * glyph that stays silent (an icon-only control a screen reader reads as
 * "button"). Both are pinned here, because both look identical on screen.
 */

function svgOf(container: HTMLElement): SVGElement {
  const svg = container.querySelector('svg')
  if (svg === null) throw new Error('no svg rendered')
  return svg
}

describe('Icon — decorative by default', () => {
  it('hides itself from assistive technology when no label is given', () => {
    const { container } = render(<Icon name="info" />)
    const svg = svgOf(container)

    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('role')
    expect(svg).not.toHaveAttribute('aria-label')
  })

  it('is absent from the accessibility tree, not merely unnamed', () => {
    render(<Icon name="inbox" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('is not focusable', () => {
    // An SVG can land in the tab order in some engines; a decoration never should.
    const { container } = render(<Icon name="x" />)
    expect(svgOf(container)).toHaveAttribute('focusable', 'false')
  })
})

describe('Icon — meaningful when labelled', () => {
  it('becomes an image with an accessible name', () => {
    render(<Icon name="check-circle" label="Verified" />)

    const image = screen.getByRole('img', { name: 'Verified' })
    expect(image).toBeInTheDocument()
    expect(image).not.toHaveAttribute('aria-hidden')
  })
})

describe('Icon — the set itself', () => {
  it('renders geometry for every name it advertises', () => {
    // Guards the pairing between the exported names and the path table: a name
    // with no paths renders an empty box that looks like a layout bug.
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />)
      expect(svgOf(container).querySelectorAll('path,circle').length, name).toBeGreaterThan(0)
      unmount()
    }
  })

  it('keeps one size and stroke weight across the set', () => {
    const seen = new Set<string>()
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />)
      const svg = svgOf(container)
      seen.add(`${svg.getAttribute('viewBox')}|${svg.getAttribute('stroke-width')}`)
      expect(svg.getAttribute('class')).toContain('size-5')
      unmount()
    }
    expect(seen.size, 'every icon shares one viewBox and stroke width').toBe(1)
  })

  it('takes its colour from the surrounding text', () => {
    // `currentColor` is why a tone can be applied to the wrapper rather than
    // threaded into every icon as a prop.
    const { container } = render(<Icon name="alert-triangle" />)
    expect(svgOf(container)).toHaveAttribute('stroke', 'currentColor')
  })

  it('exposes a stable, non-empty name list', () => {
    expect(ICON_NAMES.length).toBeGreaterThan(0)
    const unique = new Set<IconName>(ICON_NAMES)
    expect(unique.size).toBe(ICON_NAMES.length)
  })
})
