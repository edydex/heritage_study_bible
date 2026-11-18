export type SongPublicationChoice = 'published' | 'unlisted' | 'private' | 'archived'
export function songPublicationChoice(visibility: unknown, status: unknown): SongPublicationChoice {
  if (status === 'archived') return 'archived'
  return visibility === 'published' || visibility === 'unlisted' ? visibility : 'private'
}
export function songPublicationChange(choice: SongPublicationChoice) {
  return { songbookVisibility: choice === 'archived' ? 'private' : choice, status: choice === 'archived' ? 'archived' : 'draft' } as const
}
