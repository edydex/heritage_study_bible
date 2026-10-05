'use client'
import { useWorkspaceText } from './useWorkspaceText'

export default function OnlineBibleNotice({ translations }: { translations: { online?: boolean }[] }) {
  const t = useWorkspaceText()
  if (!translations.some(translation => translation.online === true)) return null
  return <small className="heritage-online-bible-notice">{t("* Online lookup: an internet connection is required to fetch new passages. Verses already added to a saved service remain available offline.")}</small>
}
