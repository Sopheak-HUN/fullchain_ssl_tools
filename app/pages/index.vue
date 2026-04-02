<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlertTriangle,
  FileText,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Upload
} from 'lucide-vue-next'
import PemPanel from '~/components/PemPanel.vue'

useHead({
  title: 'Fullchain PEM Builder'
})

const leafCert = ref('')
const privateKey = ref('')
const intermediateChain = ref('')

const certName = ref('cert.pem')
const fullchainName = ref('fullchain.pem')
const privkeyName = ref('privkey.pem')
const combinedName = ref('server.pem')

const loading = ref(false)
const errorMessage = ref('')
const serverResult = ref<any>(null)

const certPem = computed(() => leafCert.value.trim())
const chainPem = computed(() => intermediateChain.value.trim())
const keyPem = computed(() => privateKey.value.trim())

const localCombinedPem = computed(() =>
  [certPem.value, chainPem.value, keyPem.value].filter(Boolean).join('\n').trim()
)

async function handleFile(event: Event, target: 'leaf' | 'key' | 'chain') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const text = await file.text()

  if (target === 'leaf') leafCert.value = text
  if (target === 'key') privateKey.value = text
  if (target === 'chain') intermediateChain.value = text

  input.value = ''
}

async function copyText(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch (error) {
    console.error('Copy failed:', error)
  }
}

function downloadText(filename: string, content: string) {
  if (!content) return

  const blob = new Blob(
    [content.endsWith('\n') ? content : `${content}\n`],
    { type: 'application/x-pem-file' }
  )

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function buildFullchain() {
  errorMessage.value = ''
  serverResult.value = null

  if (!certPem.value?.trim()) {
    errorMessage.value = 'Certificate is required'
    return
  }

  loading.value = true

  try {
    const result = await $fetch<{
      certPem: string
      fullchainPem: string
      privkeyPem: string
      serverPem: string
      chainSource: 'provided' | 'aia-fetch' | 'not-found'
      keyMatches: boolean | null
      verifyOutput: string
      verifyOk: boolean
      warnings: string[]
    }>('/api/fullchain', {
      method: 'POST',
      body: {
        cert: certPem.value.trim(),
        key: keyPem.value?.trim() || '',
        chain: chainPem.value?.trim() || ''
      }
    })

    serverResult.value = result
  } catch (error: any) {
    console.error('buildFullchain error:', error)

    errorMessage.value =
      error?.data?.statusMessage ||
      error?.data?.message ||
      error?.statusMessage ||
      error?.message ||
      'Failed to build fullchain'
  } finally {
    loading.value = false
  }
}

const displayCertPem = computed(() => serverResult.value?.certPem || certPem.value)
const displayFullchainPem = computed(() => serverResult.value?.fullchainPem || '')
const displayPrivkeyPem = computed(() => serverResult.value?.privkeyPem || keyPem.value)
const displayServerPem = computed(() => serverResult.value?.serverPem || localCombinedPem.value)
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
    <div class="max-w-7xl mx-auto">
      <header class="mb-8">
        <div class="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300">
          SSL / TLS Utility
        </div>

        <h1 class="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
          Fullchain PEM Builder + Validator
        </h1>

        <p class="mt-4 max-w-4xl text-slate-300 text-lg leading-8">
          Upload certificate files, auto-build
          <code class="bg-slate-800 px-2 py-1 rounded">fullchain.pem</code>,
          validate the chain with OpenSSL, and verify whether the private key matches the certificate.
        </p>
      </header>

      <main class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section class="xl:col-span-2 rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl p-6 md:p-8">
          <div class="space-y-8">
            <div>
              <h2 class="text-2xl font-semibold flex items-center gap-2">
                <ShieldCheck class="w-6 h-6" />
                Upload certificate materials
              </h2>
              <p class="mt-2 text-slate-300 leading-7">
                If intermediate chain is missing, backend will try to fetch it from the certificate AIA URL.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div class="flex items-start gap-3 mb-4">
                  <div class="rounded-xl bg-slate-900 p-2 border border-slate-800">
                    <FileText class="w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-slate-100">Leaf certificate (.crt / .pem)</h3>
                    <p class="text-sm text-slate-400 mt-1">Required</p>
                  </div>
                </div>

                <label class="block">
                  <span class="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm cursor-pointer hover:bg-slate-900 transition">
                    <Upload class="w-4 h-4" />
                    Upload file
                  </span>
                  <input
                    type="file"
                    accept=".crt,.pem,.cer,text/plain"
                    class="hidden"
                    @change="handleFile($event, 'leaf')"
                  />
                </label>

                <textarea
                  v-model="leafCert"
                  rows="6"
                  class="mt-4 w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                  placeholder="Paste certificate content here."
                />
              </div>

              <div class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div class="flex items-start gap-3 mb-4">
                  <div class="rounded-xl bg-slate-900 p-2 border border-slate-800">
                    <KeyRound class="w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-slate-100">Private key (.key / .pem)</h3>
                    <p class="text-sm text-slate-400 mt-1">Optional but recommended for matching check</p>
                  </div>
                </div>

                <label class="block">
                  <span class="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm cursor-pointer hover:bg-slate-900 transition">
                    <Upload class="w-4 h-4" />
                    Upload file
                  </span>
                  <input
                    type="file"
                    accept=".key,.pem,text/plain"
                    class="hidden"
                    @change="handleFile($event, 'key')"
                  />
                </label>

                <textarea
                  v-model="privateKey"
                  rows="6"
                  class="mt-4 w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                  placeholder="Paste private key content here."
                />
              </div>
            </div>

            <div class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div class="flex items-start gap-3 mb-4">
                <div class="rounded-xl bg-slate-900 p-2 border border-slate-800">
                  <Upload class="w-5 h-5" />
                </div>
                <div>
                  <h3 class="font-semibold text-slate-100">Intermediate chain (.crt / .pem)</h3>
                  <p class="text-sm text-slate-400 mt-1">
                    Optional. If omitted, backend will try to discover it.
                  </p>
                </div>
              </div>

              <label class="block">
                <span class="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm cursor-pointer hover:bg-slate-900 transition">
                  <Upload class="w-4 h-4" />
                  Upload file
                </span>
                <input
                  type="file"
                  accept=".crt,.pem,.cer,text/plain"
                  class="hidden"
                  @change="handleFile($event, 'chain')"
                />
              </label>

              <textarea
                v-model="intermediateChain"
                rows="8"
                class="mt-4 w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                placeholder="Paste one or more intermediate certificates here."
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label class="block text-sm font-medium text-slate-200 mb-2">cert filename</label>
                <input
                  v-model="certName"
                  class="w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-200 mb-2">fullchain filename</label>
                <input
                  v-model="fullchainName"
                  class="w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-200 mb-2">privkey filename</label>
                <input
                  v-model="privkeyName"
                  class="w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-200 mb-2">server filename</label>
                <input
                  v-model="combinedName"
                  class="w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-4">
              <button
                type="button"
                @click="buildFullchain"
                :disabled="loading || !certPem"
                class="rounded-2xl bg-cyan-500 text-slate-950 px-5 py-3 font-semibold hover:bg-cyan-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span class="inline-flex items-center gap-2">
                  <LoaderCircle v-if="loading" class="w-4 h-4 animate-spin" />
                  Build and validate
                </span>
              </button>

              <div v-if="errorMessage" class="text-red-300 text-sm">
                {{ errorMessage }}
              </div>
            </div>

            <div v-if="serverResult" class="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div class="grid md:grid-cols-2 gap-4 text-sm">
                <div class="rounded-xl bg-slate-900 border border-slate-800 p-3">
                  <div class="text-slate-400">Intermediate source</div>
                  <div class="text-slate-100 mt-1">
                    {{ serverResult.chainSource || 'unknown' }}
                  </div>
                </div>

                <div class="rounded-xl bg-slate-900 border border-slate-800 p-3">
                  <div class="text-slate-400">Cert / key match</div>
                  <div class="text-slate-100 mt-1">
                    {{ serverResult.keyMatches === null ? 'Not checked' : serverResult.keyMatches ? 'Matched' : 'Not matched' }}
                  </div>
                </div>
              </div>

              <div class="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <div class="text-slate-400 mb-2">OpenSSL verify output</div>
                <pre class="text-xs whitespace-pre-wrap text-slate-200">{{ serverResult.verifyOutput }}</pre>
              </div>

              <div
                v-if="serverResult.warnings?.length"
                class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
              >
                <div class="font-semibold text-amber-200 mb-2">Warnings</div>
                <ul class="list-disc list-inside text-sm text-amber-100 space-y-1">
                  <li v-for="warning in serverResult.warnings" :key="warning">{{ warning }}</li>
                </ul>
              </div>
            </div>

            <div class="flex flex-col gap-6">
              <PemPanel
                title="cert.pem"
                subtitle="Leaf certificate only"
                :filename="certName"
                :content="displayCertPem"
                :disabled="!displayCertPem"
                @copy="copyText(displayCertPem)"
                @download="downloadText(certName, displayCertPem)"
              />

              <PemPanel
                title="fullchain.pem"
                subtitle="Leaf certificate + intermediate chain"
                :filename="fullchainName"
                :content="displayFullchainPem"
                :disabled="!displayFullchainPem"
                @copy="copyText(displayFullchainPem)"
                @download="downloadText(fullchainName, displayFullchainPem)"
              />

              <PemPanel
                title="privkey.pem"
                subtitle="Private key only"
                :filename="privkeyName"
                :content="displayPrivkeyPem"
                :disabled="!displayPrivkeyPem"
                @copy="copyText(displayPrivkeyPem)"
                @download="downloadText(privkeyName, displayPrivkeyPem)"
              />

              <PemPanel
                title="server.pem"
                subtitle="fullchain + private key"
                :filename="combinedName"
                :content="displayServerPem"
                :disabled="!displayServerPem"
                @copy="copyText(displayServerPem)"
                @download="downloadText(combinedName, displayServerPem)"
              />
            </div>
          </div>
        </section>

        <aside class="rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl p-6 space-y-6">
          <div>
            <h3 class="text-xl font-semibold">Important</h3>
            <p class="mt-2 text-slate-300 leading-7 text-sm">
              <code class="bg-slate-950 px-1.5 py-0.5 rounded">.crt + .key</code>
              does not automatically mean you have a valid fullchain.
              A proper public TLS chain usually needs the intermediate CA certificate too.
            </p>
          </div>

          <div>
            <h4 class="font-semibold text-slate-100">Expected outputs</h4>
            <ul class="mt-2 space-y-2 text-sm text-slate-300 list-disc list-inside">
              <li><strong>cert.pem</strong>: leaf cert only</li>
              <li><strong>fullchain.pem</strong>: leaf + intermediate(s)</li>
              <li><strong>privkey.pem</strong>: private key only</li>
              <li><strong>server.pem</strong>: fullchain + private key</li>
            </ul>
          </div>

          <div class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <h4 class="font-semibold text-slate-100">Kubernetes</h4>
            <div class="mt-3 space-y-3 text-sm text-slate-300">
              <code class="block rounded-xl bg-slate-900 p-3 overflow-x-auto">tls.crt = fullchain.pem</code>
              <code class="block rounded-xl bg-slate-900 p-3 overflow-x-auto">tls.key = privkey.pem</code>
            </div>
          </div>

          <div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
            <div class="flex items-start gap-3">
              <AlertTriangle class="w-5 h-5 mt-0.5" />
              <div>
                <p class="font-semibold">Reality check</p>
                <p class="mt-1 text-sm leading-6">
                  Some certificates do not expose a usable AIA URL, and some chains require multiple intermediates.
                  So auto-fetch improves results, but it is not guaranteed to fully solve every CA chain.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  </div>
</template>