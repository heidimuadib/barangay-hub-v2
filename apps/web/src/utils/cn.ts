import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The project's custom font sizes, declared to tailwind-merge (UI-B).
 *
 * `globals.css` defines four type steps as theme tokens — `--text-body-resident`,
 * `--text-body-staff`, `--text-dense`, `--text-eyebrow` — which Tailwind turns
 * into `text-body-staff` and friends. tailwind-merge has no way to know they are
 * font sizes: it only sees `text-*`, and `text-*` is overwhelmingly a COLOUR, so
 * it classified them as colours and treated them as conflicting.
 *
 * The consequence was silent and serious. `buttonClasses` composes
 * `cn('bg-brand-700 text-white', …, 'text-body-staff')`, and tailwind-merge
 * resolved that "conflict" by dropping `text-white` — so every primary and
 * danger button lost its text colour and fell back to inherited ink. Measured on
 * the public portal's "Create account": neutral-700 on brand-700, **1.36:1**,
 * against a 4.5 minimum. It looked like a rendering artifact and was a real
 * contrast failure on a call to action.
 *
 * Declaring them here fixes it at the root, for every call site that exists and
 * every one that comes later, rather than by reordering the arguments at each
 * one — which would only move which class gets dropped.
 *
 * Keep this list in step with the `--text-*` tokens in `globals.css`;
 * `cn.test.ts` fails if a size and a colour start eating each other again.
 */
const FONT_SIZES = ['body-resident', 'body-staff', 'dense', 'eyebrow'] as const

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...FONT_SIZES] }],
    },
  },
})

/** Merges conditional class names, resolving Tailwind conflicts predictably. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
