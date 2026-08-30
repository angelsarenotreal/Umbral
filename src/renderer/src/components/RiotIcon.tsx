import React from 'react'

interface Props {
  size?: number
  className?: string
}

export default function RiotIcon({ size = 18, className = '' }: Props): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M13.65 4.14L6.2 6v4.45l7.45-1.85V4.14zm.98 4.2L7.18 10.2v4.46l7.45-1.86V8.34zm.97 4.2l-7.44 1.86v4.45l7.44-1.85v-4.46zM6.16 6.32L1.5 7.4v9.08l4.66-1.16V6.32zM17.47 3.5L22.5 5.5v12.87l-5.03-1.37V3.5z" />
    </svg>
  )
}
