import { signOutAction } from '../actions/sign-out'

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        Sign out
      </button>
    </form>
  )
}
