'use client'
import PlanServiceClient from './PlanServiceClient'
import PlannerSongCreator from './PlannerSongCreator'
export default function PlanServicePayloadClient() { return <PlanServiceClient SongCreator={PlannerSongCreator} /> }
