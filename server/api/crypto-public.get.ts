import { defineEventHandler } from 'h3'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineEventHandler(() => {
  const publicKey = readFileSync(resolve('server/keys/public.pem'), 'utf8')

  return {
    publicKey
  }
})