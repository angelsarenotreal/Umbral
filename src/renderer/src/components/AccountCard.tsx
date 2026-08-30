import React from 'react'
import { Check } from 'lucide-react'
import RiotIcon from './RiotIcon'
import type { Account } from '../../../shared/types'
import { api } from '../lib/ipc'

interface Props {
  account: Account
  folderName?: string
  showFolderColumn?: boolean
  showLastUsedColumn?: boolean
  isFolderView?: boolean
  isSelected?: boolean
  isChecked?: boolean
  anyChecked?: boolean
  onSelect: (account: Account) => void
  onToggleCheck: (id: string) => void
  onCopy: (text: string, label: string) => void
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSec < 60) return 'Less than a minute ago'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`
  if (diffSec < 7200) return '1 hour ago'
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`
  if (diffSec < 172800) return 'Yesterday'
  if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)} days ago`
  return `${Math.floor(diffSec / 86400)} days ago`
}

export default function AccountCard({
  account,
  folderName = '-',
  showFolderColumn = true,
  showLastUsedColumn = true,
  isFolderView = false,
  isSelected = false,
  isChecked = false,
  anyChecked = false,
  onSelect,
  onToggleCheck,
  _onCopy
}: Props & { _onCopy?: any }): JSX.Element {
  const formattedTitle =
    account.title ||
    `${account.summonerName || account.username}${account.summonerTag ? `#${account.summonerTag}` : ''}`
  const lastUsedLabel = formatRelativeTime(account.lastUsedAt || account.updatedAt)

  const iconSrc = account.iconUrl || (account.iconId ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${account.iconId}.jpg` : null)
  const [imgError, setImgError] = React.useState(false)

  React.useEffect(() => {
    setImgError(false)
  }, [iconSrc])

  const rawRankSubtitle =
    account.rankLp && account.rankLp !== 'UNRANKED'
      ? account.rankLp
      : account.rank && account.rank.toUpperCase() !== 'UNRANKED'
      ? account.rank.toUpperCase()
      : account.username

  const rankSubtitle = rawRankSubtitle
    .replace(/\b([I|V|X]+)\s+I\s+LP\b/gi, '$1 1 LP')
    .replace(/\b([I|V|X]+)\s+II\s+LP\b/gi, '$1 2 LP')
    .replace(/\b([I|V|X]+)\s+III\s+LP\b/gi, '$1 3 LP')
    .replace(/\b([I|V|X]+)\s+IV\s+LP\b/gi, '$1 4 LP')

  const handleLaunchWeb = (e: React.MouseEvent) => {
    e.stopPropagation()
    api.shell.openExternal('https://account.riotgames.com/')
  }

  return (
    <div
      onClick={() => onSelect(account)}
      style={{ paddingLeft: isFolderView ? '16px' : '14px', paddingRight: isFolderView ? '18px' : '16px' }}
      className={`group relative flex items-center justify-between ${
        isFolderView ? 'h-[68px]' : 'h-[60px]'
      } w-full rounded-xl cursor-pointer select-none transition-all duration-150 ${
        isSelected
          ? 'bg-[#181818] border border-[#262626] shadow-md'
          : isChecked
          ? 'bg-[#141414] border border-[#222222]'
          : 'hover:bg-[#121212] border-b border-[#141414]'
      }`}
    >
      {/* Selected Left Indicator Pill */}
      {isSelected && (
        <div
          className="absolute bg-white rounded-r-full"
          style={{ left: 0, top: isFolderView ? '14px' : '12px', bottom: isFolderView ? '14px' : '12px', width: '3px' }}
        />
      )}

      {/* Left section: Checkbox + Avatar + Title & Rank/LP */}
      <div className={`flex items-center ${isFolderView ? 'gap-3.5' : 'gap-3'} min-w-0 flex-1 pr-3`}>
        {/* Multi-select Checkbox (Hover or Checked or Multi-select Active) */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onToggleCheck(account.id)
          }}
          className={`${
            isFolderView ? 'w-4.5 h-4.5' : 'w-4 h-4'
          } rounded-md flex items-center justify-center cursor-pointer transition-all shrink-0 ${
            isChecked
              ? 'bg-white text-zinc-950 border border-white shadow-sm opacity-100'
              : 'border border-[#333333] hover:border-zinc-300 bg-[#121212] opacity-0 group-hover:opacity-100'
          } ${anyChecked ? '!opacity-100' : ''}`}
        >
          {isChecked && <Check size={isFolderView ? 11 : 10} strokeWidth={3.5} />}
        </button>

        {/* Summoner Icon / Riot Squircle Avatar */}
        <div className={`${
          isFolderView ? 'w-9.5 h-9.5 rounded-xl' : 'w-8.5 h-8.5 rounded-lg'
        } bg-[#000000] border border-[#1e1e1e] flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden relative`}>
          {iconSrc && !imgError ? (
            <img
              src={iconSrc}
              alt="Summoner Icon"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <RiotIcon size={isFolderView ? 19 : 17} />
          )}
        </div>

        {/* Title & Rank + LP */}
        <div className="min-w-0 flex-1">
          <h3 className={`${
            isFolderView ? 'text-[13.5px]' : 'text-[12.5px]'
          } font-bold text-white truncate leading-tight`}>
            {formattedTitle}
          </h3>
          <p className={`${
            isFolderView ? 'text-xs' : 'text-[11px]'
          } text-zinc-400 font-mono leading-tight truncate mt-0.5 tracking-tight`}>
            {rankSubtitle}
          </p>
        </div>
      </div>

      {/* Middle Column: Last Used Timestamp (Gracefully hidden on narrow widths) */}
      {showLastUsedColumn && (
        <div className={`${showFolderColumn ? 'w-36' : 'w-32 justify-end pr-2'} shrink-0 flex items-center gap-2`}>
          <span className={`${
            isFolderView ? 'text-xs' : 'text-[11.5px]'
          } text-zinc-400 font-medium whitespace-nowrap truncate`}>
            {lastUsedLabel}
          </span>

          {!showFolderColumn && (
            <button
              type="button"
              onClick={handleLaunchWeb}
              className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-[#1e1e1e] transition-colors cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
              title="Launch Riot Account"
            >
              <svg aria-hidden="true" width="13" height="13" fill="none" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M10.25 9C10.25 8.44772 10.6977 8 11.25 8H16V12.75C16 13.3023 15.5523 13.75 15 13.75C14.4477 13.75 14 13.3023 14 12.75V11.4142L9.70711 15.7071C9.31658 16.0976 8.68342 16.0976 8.29289 15.7071C7.90237 15.3166 7.90237 14.6834 8.29289 14.2929L12.5858 10H11.25C10.6977 10 10.25 9.55228 10.25 9Z" fill="currentColor" />
                <path fillRule="evenodd" clipRule="evenodd" d="M7.80072 19.9077C8.79815 19.9981 10.094 20 12 20C13.906 20 15.2018 19.9981 16.1993 19.9077C17.1692 19.8198 17.659 19.661 18 19.4641C18.6081 19.113 19.113 18.6081 19.4641 18C19.661 17.659 19.8198 17.1692 19.9077 16.1993C19.9981 15.2018 20 13.906 20 12C20 10.094 19.9981 8.79815 19.9077 7.80072C19.8198 6.83078 19.661 6.34102 19.4641 6C19.113 5.39192 18.6081 4.88697 18 4.5359C17.659 4.33901 17.1692 4.18023 16.1993 4.09232C15.2018 4.00192 13.906 4 12 4C10.094 4 8.79815 4.00192 7.80072 4.09232C6.83078 4.18023 6.34102 4.33901 6 4.5359C5.39192 4.88697 4.88697 5.39192 4.5359 6C4.33901 6.34102 4.18023 6.83078 4.09232 7.80072C4.00192 8.79815 4 10.094 4 12C4 13.906 4.00192 15.2018 4.09232 16.1993C4.18023 17.1692 4.33901 17.659 4.5359 18C4.88697 18.6081 5.39192 19.113 6 19.4641C6.34102 19.661 6.83078 19.8198 7.80072 19.9077ZM2.80385 5C2 6.3923 2 8.26154 2 12C2 15.7385 2 17.6077 2.80385 19C3.33046 19.9121 4.08788 20.6695 5 21.1962C6.3923 22 8.26154 22 12 22C15.7385 22 17.6077 22 19 21.1962C19.9121 20.6695 20.6695 19.9121 21.1962 19C22 17.6077 22 15.7385 22 12C22 8.26154 22 6.3923 21.1962 5C20.6695 4.08788 19.9121 3.33046 19 2.80385C17.6077 2 15.7385 2 12 2C8.26154 2 6.3923 2 5 2.80385C4.08788 3.33046 3.33046 4.08788 2.80385 5Z" fill="currentColor" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Right Column: Folder Name (Gracefully hidden on medium/narrow widths) */}
      {showFolderColumn && (
        <div className="w-32 shrink-0 flex items-center justify-between pr-2">
          <span className="text-[11.5px] text-zinc-400 font-medium whitespace-nowrap truncate">
            {folderName || '-'}
          </span>

          {/* Quick Launch Website icon on hover */}
          <button
            type="button"
            onClick={handleLaunchWeb}
            className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-[#25252b] transition-colors cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
            title="Launch Riot Account"
          >
            <svg aria-hidden="true" width="13" height="13" fill="none" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M10.25 9C10.25 8.44772 10.6977 8 11.25 8H16V12.75C16 13.3023 15.5523 13.75 15 13.75C14.4477 13.75 14 13.3023 14 12.75V11.4142L9.70711 15.7071C9.31658 16.0976 8.68342 16.0976 8.29289 15.7071C7.90237 15.3166 7.90237 14.6834 8.29289 14.2929L12.5858 10H11.25C10.6977 10 10.25 9.55228 10.25 9Z" fill="currentColor" />
              <path fillRule="evenodd" clipRule="evenodd" d="M7.80072 19.9077C8.79815 19.9981 10.094 20 12 20C13.906 20 15.2018 19.9981 16.1993 19.9077C17.1692 19.8198 17.659 19.661 18 19.4641C18.6081 19.113 19.113 18.6081 19.4641 18C19.661 17.659 19.8198 17.1692 19.9077 16.1993C19.9981 15.2018 20 13.906 20 12C20 10.094 19.9981 8.79815 19.9077 7.80072C19.8198 6.83078 19.661 6.34102 19.4641 6C19.113 5.39192 18.6081 4.88697 18 4.5359C17.659 4.33901 17.1692 4.18023 16.1993 4.09232C15.2018 4.00192 13.906 4 12 4C10.094 4 8.79815 4.00192 7.80072 4.09232C6.83078 4.18023 6.34102 4.33901 6 4.5359C5.39192 4.88697 4.88697 5.39192 4.5359 6C4.33901 6.34102 4.18023 6.83078 4.09232 7.80072C4.00192 8.79815 4 10.094 4 12C4 13.906 4.00192 15.2018 4.09232 16.1993C4.18023 17.1692 4.33901 17.659 4.5359 18C4.88697 18.6081 5.39192 19.113 6 19.4641C6.34102 19.661 6.83078 19.8198 7.80072 19.9077ZM2.80385 5C2 6.3923 2 8.26154 2 12C2 15.7385 2 17.6077 2.80385 19C3.33046 19.9121 4.08788 20.6695 5 21.1962C6.3923 22 8.26154 22 12 22C15.7385 22 17.6077 22 19 21.1962C19.9121 20.6695 20.6695 19.9121 21.1962 19C22 17.6077 22 15.7385 22 12C22 8.26154 22 6.3923 21.1962 5C20.6695 4.08788 19.9121 3.33046 19 2.80385C17.6077 2 15.7385 2 12 2C8.26154 2 6.3923 2 5 2.80385C4.08788 3.33046 3.33046 4.08788 2.80385 5Z" fill="currentColor" />
              </svg>
            </button>
          </div>
        )}
      </div>
    )
}
