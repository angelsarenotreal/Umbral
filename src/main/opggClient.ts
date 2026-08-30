import https from 'https'

export interface SummonerFetchResult {
  success: boolean
  rankLp?: string
  iconId?: number
  iconUrl?: string
  error?: string
}

// In-memory cache for fast sub-millisecond responses on repeated lookups
const memoryCache = new Map<string, { data: SummonerFetchResult; timestamp: number }>()
const CACHE_TTL_MS = 3 * 60 * 1000 // 3 minutes cache

export function clearOpggCache(): void {
  memoryCache.clear()
}

// High performance keep-alive agent
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 25,
  maxFreeSockets: 10,
  timeout: 5000
})

function httpsGetFast(
  url: string,
  maxRedirects = 3
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    let settled = false

    const safeResolve = (val: { status: number; data: string }) => {
      if (settled) return
      settled = true
      resolve(val)
    }

    const safeReject = (err: any) => {
      if (settled) return
      settled = true
      reject(err)
    }

    const req = https.get(
      url,
      {
        agent,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate'
        },
        timeout: 5000
      },
      (res) => {
        res.on('error', (err) => {
          if (!settled) safeReject(err)
        })

        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          maxRedirects > 0
        ) {
          let loc = res.headers.location
          if (loc.startsWith('/')) loc = 'https://op.gg' + loc
          settled = true
          return resolve(httpsGetFast(loc, maxRedirects - 1))
        }

        let stream: any = res
        const encoding = res.headers['content-encoding']
        const zlib = require('zlib')

        if (encoding === 'gzip') {
          const decompressor = zlib.createGunzip()
          decompressor.on('error', (err: any) => {
            if (!settled) safeReject(err)
          })
          stream = res.pipe(decompressor)
        } else if (encoding === 'br') {
          const decompressor = zlib.createBrotliDecompress()
          decompressor.on('error', (err: any) => {
            if (!settled) {
              if (d && (d.includes('description') || d.includes('profile'))) {
                safeResolve({ status: res.statusCode || 200, data: d })
              } else {
                safeReject(err)
              }
            }
          })
          stream = res.pipe(decompressor)
        } else if (encoding === 'deflate') {
          const decompressor = zlib.createInflate()
          decompressor.on('error', (err: any) => {
            if (!settled) safeReject(err)
          })
          stream = res.pipe(decompressor)
        }

        let d = ''
        stream.on('data', (chunk: Buffer | string) => {
          d += chunk.toString('utf8')
          const hasMeta = d.includes('name="description"') || d.includes("name='description'")
          const hasIcon = d.includes('profile_icons/') || d.includes('profileIcon')
          if (hasMeta && hasIcon) {
            safeResolve({ status: res.statusCode || 200, data: d })
            try {
              res.destroy()
            } catch {}
          }
        })

        stream.on('end', () => {
          safeResolve({ status: res.statusCode || 200, data: d })
        })

        stream.on('error', (err: any) => {
          if (!settled) {
            if (d && (d.includes('description') || d.includes('profile'))) {
              safeResolve({ status: res.statusCode || 200, data: d })
            } else {
              safeReject(err)
            }
          }
        })
      }
    )

    req.on('error', (err) => {
      safeReject(err)
    })

    req.on('timeout', () => {
      try { req.destroy() } catch {}
      safeReject(new Error('Request timed out'))
    })
  })
}

/**
 * Format raw rank text to standardized uppercase roman numeral rank (e.g. "Diamond 4 0 LP" -> "DIAMOND IV 0 LP")
 */
export interface SummonerFetchResult {
  success: boolean
  rankLp?: string
  iconId?: number
  iconUrl?: string
  canonicalName?: string
  canonicalTag?: string
  error?: string
}

function generateLookalikeVariations(str: string): string[] {
  const variations = new Set<string>([str])

  // Degree & Ordinal lookalikes: ° (U+00B0), º (U+00BA), ˚ (U+02DA), ᵒ (U+1D52), ª (U+00AA)
  if (/[°º˚ᵒª]/.test(str)) {
    variations.add(str.replace(/[°º˚ᵒª]/g, '\u00BA')) // º (Masculine Ordinal)
    variations.add(str.replace(/[°º˚ᵒª]/g, '\u00B0')) // ° (Degree Sign)
    variations.add(str.replace(/[°º˚ᵒª]/g, '\u02DA')) // ˚ (Ring Above)
    variations.add(str.replace(/[°º˚ᵒª]/g, '\u1D52')) // ᵒ (Superscript o)
    variations.add(str.replace(/[°º˚ᵒª]/g, '\u00AA')) // ª (Feminine Ordinal)
  }

  // Dash & Hyphen lookalikes: – (U+2013), — (U+2014), − (U+2212), - (U+002D)
  if (/[–—−-]/.test(str)) {
    variations.add(str.replace(/[–—−]/g, '-'))
    variations.add(str.replace(/[-—−]/g, '–'))
    variations.add(str.replace(/[-–−]/g, '—'))
  }

  // Space variations: non-breaking space (U+00A0), ideographic space (U+3000)
  if (/[\u00A0\u3000\s]/.test(str)) {
    variations.add(str.replace(/[\u00A0\u3000]/g, ' '))
  }

  return Array.from(variations)
}

/**
 * Format raw rank text to standardized uppercase roman numeral rank (e.g. "Diamond 4 0 LP" -> "DIAMOND IV 0 LP")
 */
function formatRank(rawRank: string): string {
  let trimmed = rawRank.trim()
  if (!trimmed || trimmed.toLowerCase() === 'unranked') return 'UNRANKED'

  // Convert any erroneous Roman numerals before LP back to digits
  trimmed = trimmed
    .replace(/\b([I|V|X]+)\s+I\s+LP\b/gi, '$1 1 LP')
    .replace(/\b([I|V|X]+)\s+II\s+LP\b/gi, '$1 2 LP')
    .replace(/\b([I|V|X]+)\s+III\s+LP\b/gi, '$1 3 LP')
    .replace(/\b([I|V|X]+)\s+IV\s+LP\b/gi, '$1 4 LP')

  return trimmed
    .toUpperCase()
    .replace(/\b(IRON|BRONZE|SILVER|GOLD|PLATINUM|EMERALD|DIAMOND)\s+1\b/gi, '$1 I')
    .replace(/\b(IRON|BRONZE|SILVER|GOLD|PLATINUM|EMERALD|DIAMOND)\s+2\b/gi, '$1 II')
    .replace(/\b(IRON|BRONZE|SILVER|GOLD|PLATINUM|EMERALD|DIAMOND)\s+3\b/gi, '$1 III')
    .replace(/\b(IRON|BRONZE|SILVER|GOLD|PLATINUM|EMERALD|DIAMOND)\s+4\b/gi, '$1 IV')
}

/**
 * Fetch summoner profile icon and current rank from OP.GG with parallel speed & caching
 */
export async function fetchSummonerFromOpgg(
  gameName: string,
  tagLine: string,
  region = 'euw',
  forceRefresh = false
): Promise<SummonerFetchResult> {
  let cleanName = gameName.replace(/\[.*\]/g, '').trim()
  let cleanTag = tagLine.replace(/^#/, '').replace(/\[.*\]/g, '').trim()

  if (cleanName.includes('#')) {
    const parts = cleanName.split('#')
    cleanName = parts[0].trim()
    if (!cleanTag) {
      cleanTag = parts[1].trim()
    }
  }

  const cleanRegion = (region || 'euw').toLowerCase().trim()
  if (!cleanTag) {
    cleanTag = cleanRegion
  }

  if (!cleanName) {
    return { success: false, error: 'Empty game name' }
  }

  const cacheKey = `${cleanRegion}:${cleanName.toLowerCase()}:${cleanTag.toLowerCase()}`

  if (!forceRefresh) {
    const cached = memoryCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data
    }
  }

  const nameVariants = generateLookalikeVariations(cleanName)
  const tagVariants = generateLookalikeVariations(cleanTag)

  let lastError = 'Summoner not found'

  for (const n of nameVariants) {
    for (const t of tagVariants) {
      const url = `https://op.gg/lol/summoners/${cleanRegion}/${encodeURIComponent(n)}-${encodeURIComponent(t)}`

      try {
        const res = await httpsGetFast(url)
        if (res.status === 404 || !res.data) {
          continue
        }

        const html = res.data

        // 1. Extract Meta description: e.g. "hjksqfkqsdj#net / Diamond 4 0 LP / 22Win 13Lose ..."
        const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
        let rankLp = ''
        if (metaMatch) {
          const parts = metaMatch[1].split('/').map((s) => s.trim())
          if (parts.length >= 2) {
            rankLp = parts[1]
          }
        }

        // 2. Extract Profile Icon
        let iconId: number | undefined
        let iconUrl: string | undefined

        const iconMatch =
          html.match(/profile_icons\/profileIcon(\d+)\.jpg/i) ||
          html.match(/profile_icons\/(\d+)\.jpg/i) ||
          html.match(/profileIcon(\d+)\.png/i)

        if (iconMatch) {
          iconId = parseInt(iconMatch[1], 10)
          iconUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${iconId}.jpg`
        } else {
          const rawIconMatch = html.match(/https:\/\/[^"']+\/profile_icons\/[^"']+/i)
          if (rawIconMatch) {
            iconUrl = rawIconMatch[0].replace(/&amp;/g, '&')
          }
        }

        // Fallback default minion icon if none
        if (!iconUrl && !iconId) {
          iconUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg`
        }

        const formattedRank = formatRank(rankLp)

        const result: SummonerFetchResult = {
          success: true,
          rankLp: formattedRank,
          iconId,
          iconUrl,
          canonicalName: n,
          canonicalTag: t
        }

        memoryCache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      } catch (err: any) {
        lastError = err.message || 'Failed to fetch OP.GG data'
      }
    }
  }

  return { success: false, error: lastError }
}
