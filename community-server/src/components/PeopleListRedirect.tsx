import { redirect } from 'next/navigation'

/** Existing collection URLs remain useful for account and role edits; their lists share People. */
export default function PeopleListRedirect() {
  redirect('/admin/people')
}
