import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/utils/cn'
import { Icon, type IconName } from './icon'

/**
 * Buttons (UI-A).
 *
 * Before this existed, `bg-brand-700 hover:bg-brand-800 … min-h-11 …` was
 * written out at every call site, which is how a 27px control reached
 * production once already (R-2-05). The 44px floor now lives in one string.
 *
 * `buttonClasses` is exported separately because a good number of the product's
 * primary actions are `next/link` navigations rather than form submissions —
 * "Start my registration", "Request a document". Those need the same appearance
 * without being a `<button>`, and a `<Link className={buttonClasses()}>` is
 * clearer than a polymorphic `as` prop that has to be typed for both.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'danger'
export type ButtonSize = 'md' | 'sm'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 border border-transparent',
  secondary: 'bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-100',
  subtle: 'bg-transparent text-neutral-700 border border-transparent hover:bg-neutral-100',
  /**
   * Outlined rather than filled, following the legacy dashboard's "Reject
   * Request" treatment. A destructive action should be unmistakable without
   * being the loudest thing on the screen — a solid red block competes with the
   * primary action for the eye, and it is not the one staff should reach for
   * first.
   */
  danger: 'bg-white text-danger-700 border border-danger-700 hover:bg-danger-100',
}

/**
 * `sm` reduces padding and type size, never height. 44px is a floor rather than
 * a default: a smaller control is a smaller target regardless of how tidy it
 * looks in a toolbar, and the e2e accessibility suite measures every visible
 * button.
 */
const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 py-2 text-body-staff',
  sm: 'min-h-11 px-3 py-1.5 text-dense',
}

const BASE = [
  'inline-flex items-center justify-center gap-2',
  'rounded-control font-medium',
  'transition-colors',
  // Disabled controls are exempt from the contrast minimum (WCAG 1.4.3), but a
  // greyed-out label nobody can read is still a bad answer. This keeps the text
  // legible and removes the affordance rather than fading the whole control.
  'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500',
  'disabled:border-neutral-200 disabled:hover:bg-neutral-100',
].join(' ')

export function buttonClasses(
  // `| undefined` spelled out on each member because `exactOptionalPropertyTypes`
  // (ADR-0003) distinguishes an absent property from one explicitly set to
  // undefined, and every caller here forwards optional props straight through.
  options: {
    variant?: ButtonVariant | undefined
    size?: ButtonSize | undefined
    className?: string | undefined
  } = {},
): string {
  const { variant = 'primary', size = 'md', className } = options
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Decorative only — the button's text carries the meaning. */
  icon?: IconName
}

export function Button({ variant, size, icon, className, type, children, ...rest }: ButtonProps) {
  return (
    <button
      // Defaulting to `button` rather than inheriting the HTML default of
      // `submit`: an unlabelled type inside a form is how a "Cancel" ends up
      // submitting it.
      type={type ?? 'button'}
      className={buttonClasses({ variant, size, className })}
      {...rest}
    >
      {icon === undefined ? null : <Icon name={icon} className="size-4" />}
      {children}
    </button>
  )
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: ButtonVariant
  /**
   * Required, not optional. An icon-only control with no accessible name is
   * invisible to a screen reader, so the type system asks for the name rather
   * than trusting a review to catch its absence.
   */
  label: string
  icon: IconName
}

export function IconButton({
  variant = 'subtle',
  label,
  icon,
  className,
  type,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      className={buttonClasses({ variant, className: cn('size-11 p-0', className) })}
      {...rest}
    >
      {/* The name is on the button, so the glyph itself stays decorative —
          otherwise assistive technology announces it twice. */}
      <Icon name={icon} />
    </button>
  )
}
