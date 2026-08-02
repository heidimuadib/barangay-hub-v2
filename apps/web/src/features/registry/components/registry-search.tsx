'use client'

import { useActionState, useState } from 'react'

import type { Result } from '@/lib/errors'
import { MIN_SEARCH_LENGTH, isSearchable } from '@/utils/normalize'

import { searchRegistryAction } from '../actions/walk-in'
import type { PersonSearchHit } from '../types/registry'
import { RegistryRows } from './registry-table'

/**
 * Registry search.
 *
 * URL PRIVACY IS THE POINT: the term is submitted as a POST body to a Server
 * Action and rendered from React state. There is no `?q=` parameter, no
 * router push and no history entry, so a resident's name can never end up in
 * a shared link, a browser history export, a referrer header or a server
 * access log (P6-C-E). That is why this is a Server Action rather than a
 * filtered route.
 */
export function RegistrySearch({ barangayId }: { barangayId: string }) {
  const [state, formAction, isPending] = useActionState<
    Result<readonly PersonSearchHit[]> | null,
    FormData
  >(searchRegistryAction, null)
  const [term, setTerm] = useState('')

  // The same floor the schema and the SQL function enforce. Checking it here
  // only avoids a pointless round trip — it is not the security boundary.
  const tooShort = term.length > 0 && !isSearchable(term)

  const fieldError = state && !state.ok ? (state.error.fieldErrors?.term?.[0] ?? null) : null
  const generalError = state && !state.ok && fieldError === null ? state.error.message : null
  const hits = state?.ok === true ? state.data : null

  return (
    <section aria-labelledby="registry-search-heading" className="flex flex-col gap-4">
      <h2 id="registry-search-heading" className="sr-only-focusable">
        Search the registry
      </h2>

      <form
        action={formAction}
        noValidate
        className="rounded-lg border border-neutral-200 bg-white p-4"
      >
        <input type="hidden" name="barangayId" value={barangayId} />
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-64 flex-1 flex-col gap-1">
            <label htmlFor="registry-term" className="text-sm font-medium text-neutral-900">
              Find a resident
            </label>
            <input
              id="registry-term"
              name="term"
              type="search"
              autoComplete="off"
              required
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              aria-describedby="registry-term-hint"
              {...(fieldError || tooShort ? { 'aria-invalid': true } : {})}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={isPending || !isSearchable(term)}
            className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {isPending ? 'Searching…' : 'Search'}
          </button>
        </div>
        <p id="registry-term-hint" className="mt-2 text-sm text-neutral-500">
          Search by name. What you type stays out of the web address, so this page is never
          shareable with someone else’s details in it.
        </p>
        {tooShort ? (
          <p role="status" className="mt-2 text-sm text-neutral-700">
            Type at least {MIN_SEARCH_LENGTH} characters.
          </p>
        ) : null}
        {fieldError ? (
          <p role="alert" className="text-danger-700 mt-2 text-sm">
            {fieldError}
          </p>
        ) : null}
        {generalError ? (
          <p role="alert" className="text-danger-700 mt-2 text-sm">
            {generalError}
          </p>
        ) : null}
      </form>

      {hits === null ? null : hits.length === 0 ? (
        <p
          role="status"
          className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700"
        >
          No resident in this barangay matched that search.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <p role="status" className="px-4 pt-4 text-sm text-neutral-500">
            {hits.length} match{hits.length === 1 ? '' : 'es'}
          </p>
          <RegistryRows
            entries={hits.map((hit) => ({
              personId: hit.personId,
              fullName: [hit.firstName, hit.middleName, hit.lastName]
                .filter((part): part is string => Boolean(part))
                .join(' '),
              birthdate: hit.birthdate,
              residencyBasisKey: hit.residencyBasisKey,
              sourceChannel: hit.sourceChannel,
              superseded: hit.superseded,
              hasAccount: hit.hasAccount,
              verificationState: null,
            }))}
          />
        </div>
      )}
    </section>
  )
}
