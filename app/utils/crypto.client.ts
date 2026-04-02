function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function generateAesKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function exportAesKeyRaw(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key)
}

export async function importAesKeyRaw(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptWithAes(key: CryptoKey, data: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(data))

  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )

  return {
    iv: arrayBufferToBase64(iv.buffer),
    data: arrayBufferToBase64(cipher)
  }
}

export async function decryptWithAes<T>(key: CryptoKey, encrypted: { iv: string; data: string }): Promise<T> {
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv))
  const cipher = base64ToArrayBuffer(encrypted.data)

  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipher
  )

  return JSON.parse(new TextDecoder().decode(plain)) as T
}

export async function importRsaPublicKey(pem: string): Promise<CryptoKey> {
  const clean = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '')

  const binary = base64ToArrayBuffer(clean)

  return crypto.subtle.importKey(
    'spki',
    binary,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    false,
    ['encrypt']
  )
}

export async function encryptAesKeyWithRsa(publicKeyPem: string, aesKey: CryptoKey) {
  const publicKey = await importRsaPublicKey(publicKeyPem)
  const rawKey = await exportAesKeyRaw(aesKey)

  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawKey
  )

  return arrayBufferToBase64(encryptedKey)
}