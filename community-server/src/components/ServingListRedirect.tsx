import { redirect } from 'next/navigation'

/** Teams, the schedule and away dates are managed together on the Serving page. */
export default function ServingListRedirect() {
  redirect('/admin/serving')
}

export function TeamsListRedirect() {
  redirect('/admin/serving?tab=teams')
}

export function AwayListRedirect() {
  redirect('/admin/serving?tab=away')
}
