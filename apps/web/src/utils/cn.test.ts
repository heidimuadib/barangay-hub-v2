import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('resolves conflicting Tailwind utilities in favour of the last one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  /**
   * The project's custom type steps are font SIZES, not colours.
   *
   * Without them declared, tailwind-merge saw only `text-*`, assumed a colour,
   * and dropped the real colour beside it — which is how every primary button
   * lost `text-white` and rendered neutral-700 on brand-700 at 1.36:1.
   */
  describe('custom font sizes do not eat text colours', () => {
    for (const size of ['body-resident', 'body-staff', 'dense', 'eyebrow']) {
      it(`keeps a text colour alongside text-${size}`, () => {
        const result = cn('text-white', `text-${size}`)
        expect(result).toContain('text-white')
        expect(result).toContain(`text-${size}`)
      })
    }

    it('keeps the button variant colour through the full composition', () => {
      // The exact shape `buttonClasses` builds.
      const result = cn('bg-brand-700 text-white', 'min-h-11 px-4 py-2 text-body-staff')
      expect(result).toContain('text-white')
      expect(result).toContain('text-body-staff')
    })

    it('still collapses two genuine font sizes', () => {
      expect(cn('text-dense', 'text-body-staff')).toBe('text-body-staff')
    })

    it('still collapses two genuine text colours', () => {
      expect(cn('text-white', 'text-neutral-900')).toBe('text-neutral-900')
    })
  })
})
