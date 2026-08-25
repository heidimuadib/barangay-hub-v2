import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ProfileForm } from '@/features/identity/components/profile-form'
import { SignInForm } from '@/features/identity/components/sign-in-form'
import { SignUpForm } from '@/features/identity/components/sign-up-form'
import { OnboardingForm } from '@/features/registry/components/onboarding-form'

vi.mock('@/features/identity/actions/sign-in', () => ({
  signInAction: vi.fn(),
}))

vi.mock('@/features/identity/actions/sign-up', () => ({
  signUpAction: vi.fn(),
}))

vi.mock('@/features/identity/actions/update-profile', () => ({
  updateProfileAction: vi.fn(),
}))

vi.mock('@/features/registry/actions/onboarding', () => ({
  completeOnboardingAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

describe('auth and resident form presentation', () => {
  it('gives sign-in fields explicit labels and password autocomplete', () => {
    render(<SignInForm />)

    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveClass('min-h-11')
  })

  it('keeps sign-up guidance and confirmation fields accessible', () => {
    render(<SignUpForm />)

    expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    expect(screen.getByRole('button', { name: 'Create account' })).toHaveClass('min-h-11')
  })

  it('does not mark the account field invalid before validation runs', () => {
    render(<ProfileForm initialDisplayName="Juan Dela Cruz (Test)" />)

    const displayName = screen.getByLabelText(/display name/i)
    expect(displayName).toHaveValue('Juan Dela Cruz (Test)')
    expect(displayName).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('min-h-11')
  })
})

describe('onboarding form presentation', () => {
  it('groups the focused registration flow and explains the other residency basis', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm barangays={[{ id: 'barangay-1', name: 'San Isidro (Test)' }]} />)

    expect(screen.getByRole('group', { name: 'Your barangay' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Your name' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Contact and residence' })).toBeInTheDocument()

    const basis = screen.getByLabelText(/how do you live at this address/i)
    await user.selectOptions(basis, 'other')

    expect(screen.getByLabelText(/please explain your arrangement/i)).toBeRequired()
    expect(screen.getByRole('button', { name: 'Save and continue' })).toHaveClass('min-h-11')
    expect(screen.getByText(/a barangay reviewer checks them/i)).toBeInTheDocument()
  })
})
