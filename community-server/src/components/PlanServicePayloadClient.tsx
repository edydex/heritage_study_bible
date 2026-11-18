'use client'
import PlanServiceClient from './PlanServiceClient'
import PlannerSongCreator from './PlannerSongCreator'
import { useAuth } from '@payloadcms/ui'
export default function PlanServicePayloadClient() {
  const {user} = useAuth()
  return <PlanServiceClient SongCreator={user ? PlannerSongCreator : undefined} />
}
