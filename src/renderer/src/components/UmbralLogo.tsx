import React from 'react'

interface Props {
  size?: number
  className?: string
}

export default function UmbralLogo({ size = 24, className = '' }: Props): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Sleek, iconic Umbral 'U' Eclipse Gateway Monogram (Expanded Edge-to-Edge) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 1.5h5.5v11c0 2.49 2.01 4.5 4.5 4.5s4.5-2.01 4.5-4.5V1.5H22v11c0 5.52-4.48 10-10 10s-10-4.48-10-10V1.5z"
      />
      {/* Eclipse Core Accent */}
      <circle cx="12" cy="6.5" r="2.8" />
    </svg>
  )
}
