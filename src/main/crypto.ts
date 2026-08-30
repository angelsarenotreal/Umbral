import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, createHash } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const SALT_LENGTH = 32
const PBKDF2_ITERATIONS = 310_000
const PBKDF2_DIGEST = 'sha256'

export interface EncryptedBlob {
  iv: string
  tag: string
  ciphertext: string
  version: number
}

/**
 * Generate a random salt for new vaults.
 */
export function generateSalt(): string {
  return randomBytes(SALT_LENGTH).toString('hex')
}

/**
 * Derive a 256-bit key from the master password using PBKDF2.
 */
export function deriveKey(masterPassword: string, saltHex: string): Buffer {
  const salt = Buffer.from(saltHex, 'hex')
  return pbkdf2Sync(masterPassword, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST)
}

/**
 * Hash the derived key for storage comparison (never store the plaintext key).
 */
export function hashKey(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 */
export function encrypt(plaintext: string, key: Buffer): EncryptedBlob {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    version: 1
  }
}

/**
 * Decrypt an AES-256-GCM encrypted blob.
 */
export function decrypt(blob: EncryptedBlob, key: Buffer): string {
  const iv = Buffer.from(blob.iv, 'base64')
  const tag = Buffer.from(blob.tag, 'base64')
  const ciphertext = Buffer.from(blob.ciphertext, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Zero out a Buffer to wipe sensitive data from memory.
 */
export function wipeBuffer(buf: Buffer): void {
  buf.fill(0)
}

/**
 * Generate a cryptographically secure random password.
 */
export function generatePassword(opts: {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}): string {
  const sets: string[] = []
  if (opts.uppercase) sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
  if (opts.lowercase) sets.push('abcdefghijklmnopqrstuvwxyz')
  if (opts.numbers) sets.push('0123456789')
  if (opts.symbols) sets.push('!@#$%^&*()_+-=[]{}|;:,.<>?')
  if (sets.length === 0) sets.push('abcdefghijklmnopqrstuvwxyz')
  const charset = sets.join('')
  let password = ''
  // Use rejection sampling to avoid modulo bias
  const randomBuffer = randomBytes(opts.length * 4)
  let idx = 0
  while (password.length < opts.length) {
    const byte = randomBuffer[idx++ % randomBuffer.length]
    if (byte < 256 - (256 % charset.length)) {
      password += charset[byte % charset.length]
    }
  }
  return password
}
