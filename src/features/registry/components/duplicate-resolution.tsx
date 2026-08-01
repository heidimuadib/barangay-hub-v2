'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId, useRef, useState } from 'react'

import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'

import { resolveDuplicateAction, type ResolveDuplicateResult } from '../actions/resolve-duplicate'
import { RESIDENCY_BASES } from '../constants'
import type { DuplicateComparisonRow, RegistryEntry, SimilarityBand } from '../types/registry'

/**
 * Duplicate review and supersede-link resolution (Slice 2E; ADR-0006 §D2-02).
 *
 * The comparison is visible to every `registry.read` holder; the resolution
 * controls render only when the server says the caller holds
 * `registry.resolve_duplicates` — and that rendering is convenience, because
 * the action guard and the definer function both re-check it.
 *
 * Nothing here merges: the ONLY operation is an explicit supersede with a
 * deliberately chosen survivor and a written reason, confirmed in a panel
 * that spells out the consequences. Names and birthdates are presented as
 * signals, never proof (points 9–10).
 */

const BAND_COPY: Record<SimilarityBand, string> = {
  near_identical: 'Names are nearly identical',
  strong: 'Names are strongly similar',
  possible: 'Names are similar',
}

function ComparisonRow({
  label,
  current,
  candidate,
  emphasis = false,
}: {
  label: string
  current: string
  candidate: string
  emphasis?: boolean
}) {
  return (
    <>
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{current}</dd>
      <dd className={emphasis ? 'font-medium text-neutral-900' : 'text-neutral-900'}>
        {candidate}
      </dd>
    </>
  )
}

function CandidateCard({
  barangayId,
  person,
  candidate,
  canResolve,
  open,
  onToggle,
}: {
  barangayId: string
  person: RegistryEntry
  candidate: DuplicateComparisonRow
  canResolve: boolean
  open: boolean
  onToggle: () => void
}) {
  const [state, formAction, isPending] = useActionState<ResolveDuplicateResult | null, FormData>(
    resolveDuplicateAction,
    null,
  )
  const [survivor, setSurvivor] = useState<'current' | 'candidate' | null>(null)
  // Controlled, like the walk-in form: React resets an uncontrolled form when
  // its action resolves, so a REFUSED attempt (both-accounts, open
  // application) would silently wipe the typed reason and native `required`
  // validation would then block the retry without a word.
  const [reason, setReason] = useState('')

  useRefreshOnSuccess([state])

  const reasonId = useId()
  const groupId = useId()
  const headingId = useId()
  const outcomeRef = useRef<HTMLDivElement | null>(null)

  // Focus lands on the outcome so keyboard and screen-reader users hear it.
  useEffect(() => {
    if (state !== null) outcomeRef.current?.focus()
  }, [state])

  const resolved = state?.ok === true ? state.data : null
  const errorMessage = state && !state.ok ? state.error.message : null
  const reasonError = state && !state.ok ? (state.error.fieldErrors?.reason?.[0] ?? null) : null

  const bothAccounts = person.hasAccount && candidate.hasAccount
  const survivorPersonId = survivor === 'current' ? person.personId : candidate.personId
  const loserPersonId = survivor === 'current' ? candidate.personId : person.personId

  if (resolved) {
    return (
      <div
        ref={outcomeRef}
        tabIndex={-1}
        role="status"
        className="border-success-100 rounded-lg border bg-white p-6"
      >
        <h3 className="text-lg font-bold">Duplicate resolved</h3>
        <p className="mt-2 text-neutral-700">
          The superseded record is preserved and now points at the surviving one. Both remain
          readable forever.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/staff/registry/${resolved.survivorPersonId}`}
            className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white"
          >
            Open the surviving record
          </Link>
          <Link
            href={`/staff/registry/${resolved.supersededPersonId}`}
            className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100"
          >
            Open the superseded record
          </Link>
        </div>
      </div>
    )
  }

  // Each candidate is a self-contained comparison: an <article> labelled by
  // its own heading, so assistive technology can navigate between candidates
  // as discrete items rather than one undifferentiated run of text.
  return (
    <article
      aria-labelledby={headingId}
      className="rounded-lg border border-neutral-200 bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-lg font-bold">
          <Link href={`/staff/registry/${candidate.personId}`} className="text-brand-700 underline">
            {candidate.fullName}
          </Link>
        </h3>
        <p className="text-sm text-neutral-700">
          {BAND_COPY[candidate.similarityBand]}
          {candidate.sameBirthdate ? ' · same birthdate' : ''}
        </p>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        A matching name or birthdate is a signal, not proof of identity — compare, then decide.
      </p>

      {/* Side by side: same fields, two columns, explicit headers. */}
      <dl className="mt-4 grid grid-cols-[minmax(6rem,auto)_1fr_1fr] gap-x-4 gap-y-2">
        <dt className="sr-only-focusable">Field</dt>
        <dd className="text-sm font-medium text-neutral-900">This record</dd>
        <dd className="text-sm font-medium text-neutral-900">Candidate</dd>
        <ComparisonRow
          label="Birthdate"
          current={person.birthdate ?? 'Not recorded'}
          candidate={candidate.birthdate ?? 'Not recorded'}
          emphasis={candidate.sameBirthdate}
        />
        <ComparisonRow
          label="Residency"
          current={RESIDENCY_BASES[person.residencyBasisKey].label}
          candidate={RESIDENCY_BASES[candidate.residencyBasisKey].label}
        />
        <ComparisonRow
          label="Recorded via"
          current={person.sourceChannel === 'staff' ? 'walk-in' : 'self-registration'}
          candidate={candidate.sourceChannel === 'staff' ? 'walk-in' : 'self-registration'}
        />
        <ComparisonRow
          label="Account"
          current={person.hasAccount ? 'linked' : 'none'}
          candidate={candidate.hasAccount ? 'linked' : 'none'}
        />
        <ComparisonRow
          label="Verification"
          current={person.verificationState ?? 'no application'}
          candidate={candidate.verificationState ?? 'no application'}
        />
      </dl>

      {canResolve ? (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={open}
            onClick={onToggle}
            className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100"
          >
            Resolve as the same person…
          </button>

          {open ? (
            <form
              action={formAction}
              className="border-warning-100 mt-3 flex flex-col gap-4 rounded-md border p-4"
            >
              <input type="hidden" name="barangayId" value={barangayId} />
              <input type="hidden" name="survivorPersonId" value={survivorPersonId} />
              <input type="hidden" name="loserPersonId" value={loserPersonId} />

              <fieldset>
                <legend id={groupId} className="font-medium text-neutral-900">
                  Which record should survive?
                </legend>
                <p className="mt-1 text-sm text-neutral-500">
                  The other record is marked superseded: frozen, preserved, and pointing at the
                  survivor. This cannot be undone here.
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="radio"
                      name="survivorChoice"
                      value="current"
                      required
                      checked={survivor === 'current'}
                      onChange={() => setSurvivor('current')}
                      className="h-5 w-5"
                    />
                    <span>
                      Keep <span className="font-medium">{person.fullName}</span> (this record)
                    </span>
                  </label>
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="radio"
                      name="survivorChoice"
                      value="candidate"
                      required
                      checked={survivor === 'candidate'}
                      onChange={() => setSurvivor('candidate')}
                      className="h-5 w-5"
                    />
                    <span>
                      Keep <span className="font-medium">{candidate.fullName}</span> (the candidate)
                    </span>
                  </label>
                </div>
              </fieldset>

              {bothAccounts ? (
                <p
                  role="status"
                  className="border-warning-100 rounded-md border px-3 py-2 text-sm text-neutral-700"
                >
                  Both records have linked accounts, so this resolution will be refused: unlink one
                  deliberately through the matching workflow first. Nothing is ever chosen for you.
                </p>
              ) : person.hasAccount || candidate.hasAccount ? (
                <p className="text-sm text-neutral-500">
                  The linked account moves to the surviving record if the survivor has none — the
                  one explicit rule. The move itself is audited.
                </p>
              ) : null}

              <div className="flex flex-col gap-1">
                <label htmlFor={reasonId} className="text-sm font-medium text-neutral-900">
                  Reason (required)
                </label>
                <textarea
                  id={reasonId}
                  name="reason"
                  required
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  aria-describedby={`${reasonId}-hint`}
                  {...(reasonError ? { 'aria-invalid': true } : {})}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2"
                />
                <p id={`${reasonId}-hint`} className="text-sm text-neutral-500">
                  Kept on the superseded record and in the audit trail.
                </p>
                {reasonError ? (
                  <p role="alert" className="text-danger-700 text-sm">
                    {reasonError}
                  </p>
                ) : null}
              </div>

              {errorMessage && !reasonError ? (
                <div ref={outcomeRef} tabIndex={-1}>
                  <p role="alert" className="text-danger-700 text-sm">
                    {errorMessage}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isPending || survivor === null}
                  className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
                >
                  {isPending ? 'Resolving…' : 'Confirm: mark as the same person'}
                </button>
                <button
                  type="button"
                  onClick={onToggle}
                  className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export function DuplicateResolutionPanel({
  barangayId,
  person,
  candidates,
  canResolve,
}: {
  barangayId: string
  person: RegistryEntry
  candidates: readonly DuplicateComparisonRow[]
  canResolve: boolean
}) {
  const [openCandidateId, setOpenCandidateId] = useState<string | null>(null)

  return (
    <section aria-labelledby="duplicates-heading" className="flex flex-col gap-3">
      <h2 id="duplicates-heading" className="text-lg font-bold">
        Possible duplicate records
      </h2>

      {candidates.length === 0 ? (
        <p
          role="status"
          className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700"
        >
          No similar person record was found in this barangay.
        </p>
      ) : (
        <>
          {!canResolve ? (
            <p className="text-sm text-neutral-500">
              Resolving duplicates needs the resolution capability; your role can compare but not
              resolve.
            </p>
          ) : null}
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.personId}
              barangayId={barangayId}
              person={person}
              candidate={candidate}
              canResolve={canResolve}
              open={openCandidateId === candidate.personId}
              onToggle={() =>
                setOpenCandidateId(
                  openCandidateId === candidate.personId ? null : candidate.personId,
                )
              }
            />
          ))}
        </>
      )}
    </section>
  )
}
