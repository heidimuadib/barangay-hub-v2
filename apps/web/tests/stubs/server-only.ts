/**
 * Test stub for the `server-only` marker package.
 *
 * `server-only` throws on import unless the bundler applies the `react-server`
 * export condition. Next.js applies it; Vitest does not, so importing any
 * server module in a unit test would throw before a single assertion ran.
 *
 * Aliasing to this empty module (see `resolve.alias` in vitest.config.ts) is the
 * exact behaviour that condition produces. It weakens nothing: `next build`
 * still resolves the real package, so a `server-only` module imported from a
 * Client Component still fails the build.
 *
 * The package's own `empty.js` cannot be aliased directly — its `exports` map
 * publishes only the root specifier.
 */
export {}
