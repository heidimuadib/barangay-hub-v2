# Vendored typefaces

## `inter-latin-wght-normal.woff2`

| | |
| --- | --- |
| Family | Inter (variable, weight axis 100–900) |
| Subset | `latin` — covers English and Filipino, including `ñ` and the acute-accented vowels common in Philippine surnames |
| Size | 47 KB |
| Licence | SIL Open Font Licence 1.1 |
| Provenance | `@fontsource-variable/inter@5.3.0`, file `files/inter-latin-wght-normal.woff2` |

### Why the file is committed rather than installed

`globals.css` named Inter in `--font-sans` from Slice 0a, but nothing ever loaded
it, so every screen rendered in the OS fallback: the typographic identity was
declared and not applied. UI-A fixes that, and had three ways to do it.

- **Google Fonts at runtime** — refused. `middleware.ts` sets `font-src 'self'`,
  so the request is blocked, and DEC-UI-01 rules out CDN dependencies outright.
- **`next/font/google`** — self-hosts at build time, which is CSP-safe, but the
  build then needs network access to fonts.googleapis.com. A build that can fail
  because a third party is unreachable is a build that can fail in a barangay
  office.
- **`next/font/local` over a committed woff2** — chosen. The build is
  reproducible offline, the bytes are pinned in git, and `next/font` still emits
  the same-origin `<link rel="preload">` and the metric-adjusted fallback that
  prevents layout shift.

The weight axis alone is enough: the design uses 400/500/600/700 and no italics,
so the 47 KB `wght` subset ships instead of the 130 KB optical-size build.

### Replacing or updating it

```bash
npm pack @fontsource-variable/inter@<version>
tar -xzf fontsource-variable-inter-<version>.tgz
cp package/files/inter-latin-wght-normal.woff2 apps/web/src/fonts/
```

Then update the version in the table above. The font is referenced from exactly
one place — the `localFont()` call in `src/app/layout.tsx` — and
`tests/unit/styles/typography.test.ts` fails if that call stops pointing at a
file that exists, or if a CDN font URL reappears anywhere in `src`.
