import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DetailList } from '@/components/ui'

describe('DetailList', () => {
  it('renders labelled values as a semantic responsive detail list', () => {
    const { container } = render(
      <DetailList
        columns={2}
        items={[
          { label: 'Purpose', value: 'Employment' },
          { label: 'Status', value: 'Waiting for review' },
        ]}
      />,
    )

    const list = container.querySelector('dl')
    expect(list).toBeInTheDocument()
    expect(list).toHaveClass('grid-cols-1', 'sm:grid-cols-2')
    expect(screen.getByText('Purpose').tagName).toBe('DT')
    expect(screen.getByText('Employment').tagName).toBe('DD')
    expect(screen.getByText('Status')).toBeInTheDocument()
  })
})
