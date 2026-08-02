import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EvidenceManager } from '@/features/registry/components/evidence-manager'
import { EvidenceViewButton } from '@/features/registry/components/evidence-viewer'
import { evidenceReadiness } from '@/features/registry/rules/evidence'
import type { EvidenceItem } from '@/features/registry/types/registry'

/**
 * Slice 2F presentation contract: the resident always knows what is missing,
 * a pending upload is visibly not counted, and a reviewer's evidence access
 * is requested on demand rather than embedded.
 */

const removeEvidenceAction = vi.fn()
const requestEvidenceUrlAction = vi.fn()

vi.mock('@/features/registry/actions/evidence', () => ({
  prepareEvidenceUploadAction: vi.fn(),
  finalizeEvidenceAction: vi.fn(),
  removeEvidenceAction: (...args: unknown[]): unknown => removeEvidenceAction(...args),
  submitApplicationAction: vi.fn(),
  requestEvidenceUrlAction: (...args: unknown[]): unknown => requestEvidenceUrlAction(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const APPLICATION = 'd0000000-0000-4000-8000-000000000001'
const BARANGAY = 'a0000000-0000-4000-8000-000000000001'

function item(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    evidenceId: 'e0000000-0000-4000-8000-000000000001',
    kind: 'identity',
    mimeType: 'image/png',
    declaredSizeBytes: 2048,
    sizeBytes: 2048,
    uploadedAt: '2026-08-02T00:00:00.000Z',
    createdAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  }
}

function renderManager(items: readonly EvidenceItem[], editable = true) {
  return render(
    <EvidenceManager
      applicationId={APPLICATION}
      items={items}
      editable={editable}
      readiness={evidenceReadiness(items)}
    />,
  )
}

describe('EvidenceManager — readiness summary', () => {
  it('names what is still needed, in words rather than colour', () => {
    renderManager([])
    expect(screen.getByText(/identity evidence — still needed/i)).toBeInTheDocument()
    expect(screen.getByText(/proof of residency — still needed/i)).toBeInTheDocument()
  })

  it('blocks submission until both required kinds are finalized', () => {
    renderManager([item({ kind: 'identity' })])
    expect(screen.getByRole('button', { name: /send for verification/i })).toBeDisabled()
    expect(screen.getByText(/add both documents above/i)).toBeInTheDocument()
  })

  it('enables submission once both are finalized', () => {
    renderManager([item({ kind: 'identity' }), item({ evidenceId: 'e2', kind: 'residency' })])
    expect(screen.getByRole('button', { name: /send for verification/i })).toBeEnabled()
    expect(screen.getByText(/identity evidence — added/i)).toBeInTheDocument()
  })

  it('says plainly that a failed upload will not be sent', () => {
    renderManager([
      item({ kind: 'identity' }),
      item({ evidenceId: 'e2', kind: 'residency' }),
      item({ evidenceId: 'e3', kind: 'supporting', uploadedAt: null, sizeBytes: null }),
    ])
    expect(
      screen.getByText(/1 document did not finish uploading and will not be sent/i),
    ).toBeInTheDocument()
  })
})

describe('EvidenceManager — evidence list', () => {
  it('describes a document by category and type, never by filename', () => {
    renderManager([item({ kind: 'residency', mimeType: 'application/pdf' })])
    expect(screen.getByText('Proof of residency')).toBeInTheDocument()
    expect(screen.getByText(/PDF document/)).toBeInTheDocument()
  })

  it('marks a pending item as unfinished and shows no size for it', () => {
    renderManager([item({ uploadedAt: null, sizeBytes: null })])
    expect(screen.getByText(/not finished/i)).toBeInTheDocument()
    expect(screen.queryByText(/2 KB/)).not.toBeInTheDocument()
  })

  it('shows the trusted size once finalized', () => {
    renderManager([item({ sizeBytes: 4096 })])
    // Scoped to the document list: the readiness summary also says "added".
    const list = screen.getByRole('list', { name: /documents you added/i })
    const listItem = within(list).getByRole('listitem')
    expect(within(listItem).getByText(/4 KB/)).toBeInTheDocument()
    expect(within(listItem).getByText('added')).toBeInTheDocument()
  })

  it('offers Remove while editable and withdraws it once frozen', () => {
    const { unmount } = renderManager([item()])
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
    unmount()

    renderManager([item()], false)
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
    // A frozen application offers no upload control and no submit control.
    expect(screen.queryByLabelText(/add identity evidence/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send for verification/i })).not.toBeInTheDocument()
  })

  it('surfaces a removal failure instead of pretending it worked', async () => {
    const user = userEvent.setup()
    removeEvidenceAction.mockResolvedValueOnce({
      ok: false,
      error: { message: 'That document could not be removed. Please try again.' },
    })

    renderManager([item()])
    await user.click(screen.getByRole('button', { name: /remove/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be removed/i)
  })
})

describe('EvidenceManager — file picker', () => {
  it('offers one picker per required category, restricted to the allow-list', () => {
    renderManager([])
    const identity = screen.getByLabelText(/add identity evidence/i)
    expect(identity).toHaveAttribute('type', 'file')
    expect(identity).toHaveAttribute('accept', '.jpg,.jpeg,.png,.webp,.pdf')
    expect(screen.getByLabelText(/add proof of residency/i)).toBeInTheDocument()
  })

  it('explains the limits before a file is chosen', () => {
    renderManager([])
    expect(screen.getAllByText(/up to 10 MB/i).length).toBeGreaterThan(0)
  })
})

describe('EvidenceViewButton — on-demand access', () => {
  it('requests nothing until the reviewer asks', () => {
    render(<EvidenceViewButton barangayId={BARANGAY} evidenceId="e1" label="identity evidence" />)
    expect(requestEvidenceUrlAction).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /view identity evidence/i })).toBeInTheDocument()
  })

  it('asks the server only on click, and never renders a URL or path', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    requestEvidenceUrlAction.mockResolvedValueOnce({
      ok: true,
      data: { url: 'http://127.0.0.1:54321/storage/v1/object/sign/x?token=y' },
    })

    render(<EvidenceViewButton barangayId={BARANGAY} evidenceId="e1" label="identity evidence" />)
    await user.click(screen.getByRole('button', { name: /view identity evidence/i }))

    expect(requestEvidenceUrlAction).toHaveBeenCalledWith({
      barangayId: BARANGAY,
      evidenceId: 'e1',
    })
    // The signed URL is handed to the browser, never written into the page.
    expect(document.body.innerHTML).not.toContain('token=y')
    expect(document.body.innerHTML).not.toContain('storage/v1')
    open.mockRestore()
  })

  it('reports a refusal without leaking why', async () => {
    const user = userEvent.setup()
    requestEvidenceUrlAction.mockResolvedValueOnce({
      ok: false,
      error: { message: 'That document could not be found.' },
    })

    render(<EvidenceViewButton barangayId={BARANGAY} evidenceId="e1" label="identity evidence" />)
    await user.click(screen.getByRole('button', { name: /view identity evidence/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not be found/i)
    expect(within(alert).queryByText(/permission|denied|bucket/i)).not.toBeInTheDocument()
  })
})
