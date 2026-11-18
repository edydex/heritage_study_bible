import ManageRegistration from '@/components/ManageRegistration'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your sign-up', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default function ManageRegistrationPage() {
  return <main className="site-main"><ManageRegistration /></main>
}
