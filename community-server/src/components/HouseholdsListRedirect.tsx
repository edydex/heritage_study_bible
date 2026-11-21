import { redirect } from 'next/navigation'

/** Households are listed with their members on the People page. */
export default function HouseholdsListRedirect() {
  redirect('/admin/people?tab=households')
}
