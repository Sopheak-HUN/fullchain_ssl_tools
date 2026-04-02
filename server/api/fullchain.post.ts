import { defineEventHandler, readBody, createError } from 'h3'
import forge from 'node-forge'
import { decryptPayload, encryptPayload } from '../utils/crypto'

type RequestBody = {
  cert?: string
  key?: string
  chain?: string
}

type ParsedCertInfo = {
  cert: forge.pki.Certificate
  pem: string
}

type CertInfo = {
  subject: string
  issuer: string
  notBefore: string
  notAfter: string
  daysLeft: number
  isExpired: boolean
  sans: string[]
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.public.payloadSecret || 'fallback-secret-for-encryption-777'

  let body = await readBody<any>(event)
  
  // If payload is encrypted, decrypt it
  if (body && typeof body.payload === 'string') {
    const decrypted = decryptPayload(body.payload, secret)
    if (decrypted) {
      body = JSON.parse(decrypted)
    }
  }

  const certInput = (body.cert || '').trim()
  const keyInput = (body.key || '').trim()
  const chainInput = (body.chain || '').trim()

  if (!certInput) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Certificate is required'
    })
  }

  const certPem = normalizePemBlocks(certInput, 'CERTIFICATE')
  const keyPem = normalizePrivateKey(keyInput)
  const providedChainPem = normalizePemBlocks(chainInput, 'CERTIFICATE')

  if (!certPem) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid leaf certificate PEM'
    })
  }

  const warnings: string[] = []

  const leaf = parseSingleCertificate(certPem, 'leaf certificate')
  const certInfo = extractCertInfo(leaf.cert)

  let finalChainPem = providedChainPem
  let chainSource: 'provided' | 'aia-fetch' | 'not-found' = 'provided'

  if (!finalChainPem) {
    const aiaUrls = extractAiaUrlsFromForge(leaf.cert)

    if (aiaUrls.length) {
      const fetched = await fetchIntermediateChain(aiaUrls)
      if (fetched) {
        finalChainPem = fetched
        chainSource = 'aia-fetch'
      } else {
        chainSource = 'not-found'
        warnings.push(
          'Intermediate CA could not be fetched from AIA URL. The generated fullchain may still be incomplete.'
        )
      }
    } else {
      chainSource = 'not-found'
      warnings.push(
        'No AIA issuer URL was found in the leaf certificate. Intermediate CA could not be auto-discovered.'
      )
    }
  }

  const fullchainPem = [certPem, finalChainPem].filter(Boolean).join('\n').trim()
  const privkeyPem = keyPem
  const serverPem = [fullchainPem, privkeyPem].filter(Boolean).join('\n').trim()

  const keyMatches = keyPem ? certMatchesPrivateKey(leaf.cert, keyPem) : null
  if (keyPem && keyMatches === false) {
    warnings.push('Private key does not match the uploaded leaf certificate.')
  }

  if (certInfo.isExpired) {
    warnings.push(`Certificate has expired ${Math.abs(certInfo.daysLeft)} day(s) ago.`)
  } else if (certInfo.daysLeft < 30) {
    warnings.push(`Certificate is expiring soon — ${certInfo.daysLeft} day(s) left.`)
  }

  const verifyResult = verifyChain(leaf.cert, finalChainPem)

  if (!finalChainPem) {
    warnings.push('A true public fullchain usually needs one or more intermediate certificates.')
  }

  const result = {
    certPem,
    fullchainPem,
    privkeyPem,
    serverPem,
    chainSource,
    keyMatches,
    certInfo,
    verifyOutput: verifyResult.message,
    verifyOk: verifyResult.ok,
    warnings
  }

  // Return encrypted result
  return {
    payload: encryptPayload(JSON.stringify(result), secret)
  }
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizePemBlocks(text: string, type: string): string {
  if (!text) return ''
  const regex = new RegExp(
    `-----BEGIN ${type}-----[\\s\\S]*?-----END ${type}-----`,
    'g'
  )
  const matches = text.match(regex) || []
  return matches.map((m) => m.trim()).join('\n')
}

function normalizePrivateKey(text: string): string {
  if (!text) return ''
  const regex =
    /-----BEGIN (?:RSA |EC |ENCRYPTED |)PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |ENCRYPTED |)PRIVATE KEY-----/g
  const matches = text.match(regex) || []
  return matches.map((m) => m.trim()).join('\n')
}

function splitPemCertificates(pemText: string): string[] {
  if (!pemText) return []
  const matches =
    pemText.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || []
  return matches.map((m) => m.trim())
}

function parseSingleCertificate(pem: string, label: string): ParsedCertInfo {
  try {
    return {
      cert: forge.pki.certificateFromPem(pem),
      pem
    }
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid ${label}`
    })
  }
}

function parseCertificateChain(pemText: string): ParsedCertInfo[] {
  return splitPemCertificates(pemText).map((pem, index) =>
    parseSingleCertificate(pem, `chain certificate #${index + 1}`)
  )
}

function extractCertInfo(cert: forge.pki.Certificate): CertInfo {
  const now = new Date()
  const notAfter = cert.validity.notAfter
  const notBefore = cert.validity.notBefore
  const daysLeft = Math.floor((notAfter.getTime() - now.getTime()) / 86400000)

  const subject = cert.subject.attributes
    .map((a) => `${a.shortName}=${a.value}`)
    .join(', ')

  const issuer = cert.issuer.attributes
    .map((a) => `${a.shortName}=${a.value}`)
    .join(', ')

  const sanExt = cert.extensions.find((e: any) => e.name === 'subjectAltName')
  const sans: string[] = sanExt
    ? (sanExt as any).altNames.map((n: any) => n.value as string)
    : []

  return {
    subject,
    issuer,
    notBefore: notBefore.toISOString(),
    notAfter: notAfter.toISOString(),
    daysLeft,
    isExpired: daysLeft < 0,
    sans
  }
}

function extractAiaUrlsFromForge(cert: forge.pki.Certificate): string[] {
  const urls = new Set<string>()

  for (const ext of cert.extensions || []) {
    if (ext.name !== 'authorityInfoAccess' || !Array.isArray((ext as any).accessDescriptions)) {
      continue
    }

    for (const desc of (ext as any).accessDescriptions) {
      const value = desc?.accessLocation?.value
      if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
        urls.add(value)
      }
    }
  }

  return [...urls]
}

async function fetchIntermediateChain(urls: string[]): Promise<string> {
  for (const url of urls) {
    try {
      const response = await fetch(url)
      if (!response.ok) continue

      const buffer = Buffer.from(await response.arrayBuffer())
      const text = buffer.toString('utf8')

      if (text.includes('-----BEGIN CERTIFICATE-----')) {
        const normalized = normalizePemBlocks(text, 'CERTIFICATE')
        if (normalized) return normalized
      }

      // Try DER -> PEM
      try {
        const asn1 = forge.asn1.fromDer(buffer.toString('binary'))
        const cert = forge.pki.certificateFromAsn1(asn1)
        return forge.pki.certificateToPem(cert).trim()
      } catch {
        // keep trying next URL
      }
    } catch {
      // keep trying next URL
    }
  }

  return ''
}

function certMatchesPrivateKey(cert: forge.pki.Certificate, privateKeyPem: string): boolean | null {
  try {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem)
    if (!privateKey) return null // unsupported key type

    const rsaKey = privateKey as forge.pki.rsa.PrivateKey
    if (!rsaKey.n || !rsaKey.e) return null // EC or non-RSA key — skip matching

    const publicKeyFromKey = forge.pki.setRsaPublicKey(rsaKey.n, rsaKey.e)
    const certPublic = cert.publicKey as forge.pki.rsa.PublicKey

    return (
      publicKeyFromKey.n.compareTo(certPublic.n) === 0 &&
      publicKeyFromKey.e.compareTo(certPublic.e) === 0
    )
  } catch {
    return null
  }
}

function verifyChain(
  leaf: forge.pki.Certificate,
  chainPem: string
): { ok: boolean; message: string } {
  const chain = parseCertificateChain(chainPem)

  if (!chain.length) {
    return {
      ok: false,
      message: 'No intermediate chain available. Structural verification could not be completed.'
    }
  }

  try {
    const caStore = forge.pki.createCaStore(chain.map((c) => c.pem))
    forge.pki.verifyCertificateChain(caStore, [leaf, ...chain.map((c) => c.cert)])

    return {
      ok: true,
      message: 'Chain structure verified against provided/fetched intermediate certificate(s).'
    }
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'Certificate chain verification failed.'
    }
  }
}