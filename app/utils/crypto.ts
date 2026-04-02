import forge from 'node-forge'

/**
 * Encrypts a string using AES-256-GCM with a derived key.
 * Format: iv_hex:tag_hex:ciphertext_hex
 */
export function encryptPayload(text: string, secret: string): string {
  if (!text) return ''
  
  // Use a fixed salt and low iterations for speed (this is app-level obfuscation/encryption)
  const key = forge.pkcs5.pbkdf2(secret, 'nu-ssl-salt', 50, 32)
  const iv = forge.random.getBytesSync(12)
  
  const cipher = forge.cipher.createCipher('AES-GCM', key)
  cipher.start({ iv })
  cipher.update(forge.util.createBuffer(text, 'utf8'))
  cipher.finish()
  
  const ivHex = forge.util.bytesToHex(iv)
  const tagHex = cipher.mode.tag.toHex()
  const encryptedHex = cipher.output.toHex()
  
  return `${ivHex}:${tagHex}:${encryptedHex}`
}

/**
 * Decrypts a string in the format: iv_hex:tag_hex:ciphertext_hex
 */
export function decryptPayload(encrypted: string, secret: string): string | null {
  if (!encrypted || !encrypted.includes(':')) return null
  
  try {
    const [ivHex, tagHex, encryptedHex] = encrypted.split(':')
    const key = forge.pkcs5.pbkdf2(secret, 'nu-ssl-salt', 50, 32)
    const iv = forge.util.hexToBytes(ivHex!)
    const tag = forge.util.hexToBytes(tagHex!)
    
    const decipher = forge.cipher.createDecipher('AES-GCM', key)
    decipher.start({ iv, tag: forge.util.createBuffer(tag!) })
    decipher.update(forge.util.createBuffer(forge.util.hexToBytes(encryptedHex!)))
    
    const success = decipher.finish()
    if (!success) return null
    
    return decipher.output.toString()
  } catch (error) {
    console.error('Decryption error:', error)
    return null
  }
}
