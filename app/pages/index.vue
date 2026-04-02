<script setup lang="ts">
import { computed, ref } from "vue";
import {
  AlertTriangle,
  FileText,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Upload,
  Trash2,
  Archive,
  Copy,
  Check,
  Server,
  Container,
} from "lucide-vue-next";
import PemPanel from "~/components/PemPanel.vue";
import {
  encryptPayload,
  decryptPayload,
} from "~/utils/crypto";

useHead({
  title: "Fullchain PEM Builder",
});

// ─── Inputs ──────────────────────────────────────────────────────────────────
const leafCert = ref("");
const privateKey = ref("");
const intermediateChain = ref("");

// ─── Filenames ───────────────────────────────────────────────────────────────
const certName = ref("cert.pem");
const fullchainName = ref("fullchain.pem");
const privkeyName = ref("privkey.pem");
const combinedName = ref("server.pem");

// ─── State ───────────────────────────────────────────────────────────────────
const loading = ref(false);
const errorMessage = ref("");
const serverResult = ref<any>(null);
const copiedKey = ref<string | null>(null);

// ─── Drag & drop state ───────────────────────────────────────────────────────
const draggingOver = ref<"leaf" | "key" | "chain" | null>(null);

// ─── K8s / config state ──────────────────────────────────────────────────────
const k8sSecretName = ref("tls-secret");
const k8sNamespace = ref("default");
const nginxCertPath = ref("/etc/ssl/fullchain.pem");
const nginxKeyPath = ref("/etc/ssl/privkey.pem");
const copiedSnippet = ref<string | null>(null);

// ─── Computed ─────────────────────────────────────────────────────────────────
const certPem = computed(() => leafCert.value.trim());
const chainPem = computed(() => intermediateChain.value.trim());
const keyPem = computed(() => privateKey.value.trim());

const localCombinedPem = computed(() =>
  [certPem.value, chainPem.value, keyPem.value]
    .filter(Boolean)
    .join("\n")
    .trim(),
);

const displayCertPem = computed(
  () => serverResult.value?.certPem || certPem.value,
);
const displayFullchainPem = computed(
  () => serverResult.value?.fullchainPem || "",
);
const displayPrivkeyPem = computed(
  () => serverResult.value?.privkeyPem || keyPem.value,
);
const displayServerPem = computed(
  () => serverResult.value?.serverPem || localCombinedPem.value,
);

const canDownloadAll = computed(
  () =>
    !!(
      displayCertPem.value ||
      displayFullchainPem.value ||
      displayPrivkeyPem.value ||
      displayServerPem.value
    ),
);

// ─── K8s YAML ────────────────────────────────────────────────────────────────
const k8sYaml = computed(() => {
  const fullchain = displayFullchainPem.value || displayCertPem.value;
  const privkey = displayPrivkeyPem.value;

  const b64crt = fullchain
    ? btoa(unescape(encodeURIComponent(fullchain.trim() + "\n")))
    : "<base64-fullchain.pem>";
  const b64key = privkey
    ? btoa(unescape(encodeURIComponent(privkey.trim() + "\n")))
    : "<base64-privkey.pem>";

  return `apiVersion: v1
kind: Secret
metadata:
  name: ${k8sSecretName.value}
  namespace: ${k8sNamespace.value}
type: kubernetes.io/tls
data:
  tls.crt: ${b64crt}
  tls.key: ${b64key}`;
});

// ─── nginx snippet ────────────────────────────────────────────────────────────
const nginxSnippet = computed(
  () => `server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     ${nginxCertPath.value};
    ssl_certificate_key ${nginxKeyPath.value};

    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
}`,
);

// ─── Apache snippet ───────────────────────────────────────────────────────────
const apacheSnippet = computed(
  () => `<VirtualHost *:443>
    ServerName your-domain.com

    SSLEngine on
    SSLCertificateFile    ${nginxCertPath.value}
    SSLCertificateKeyFile ${nginxKeyPath.value}
</VirtualHost>`,
);

// ─── File handling ────────────────────────────────────────────────────────────
async function readFileText(file: File): Promise<string> {
  return file.text();
}

async function handleFile(event: Event, target: "leaf" | "key" | "chain") {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const text = await readFileText(file);
  assignToTarget(target, text);
  input.value = "";
}

function assignToTarget(target: "leaf" | "key" | "chain", text: string) {
  if (target === "leaf") leafCert.value = text;
  if (target === "key") privateKey.value = text;
  if (target === "chain") intermediateChain.value = text;
}

// ─── Drag & drop ─────────────────────────────────────────────────────────────
function onDragOver(event: DragEvent, target: "leaf" | "key" | "chain") {
  event.preventDefault();
  draggingOver.value = target;
}

function onDragLeave() {
  draggingOver.value = null;
}

async function onDrop(event: DragEvent, target: "leaf" | "key" | "chain") {
  event.preventDefault();
  draggingOver.value = null;
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const text = await readFileText(file);
  assignToTarget(target, text);
}

// ─── Copy ─────────────────────────────────────────────────────────────────────
async function copyText(text: string, key: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedKey.value = key;
    setTimeout(() => (copiedKey.value = null), 2000);
  } catch (error) {
    console.error("Copy failed:", error);
  }
}

async function copySnippet(text: string, key: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedSnippet.value = key;
    setTimeout(() => (copiedSnippet.value = null), 2000);
  } catch (error) {
    console.error("Copy failed:", error);
  }
}

// ─── Download ─────────────────────────────────────────────────────────────────
function downloadText(filename: string, content: string) {
  if (!content) return;
  const blob = new Blob([content.endsWith("\n") ? content : `${content}\n`], {
    type: "application/x-pem-file",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadAllZip() {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  const files = [
    { name: certName.value, content: displayCertPem.value },
    { name: fullchainName.value, content: displayFullchainPem.value },
    { name: privkeyName.value, content: displayPrivkeyPem.value },
    { name: combinedName.value, content: displayServerPem.value },
  ];

  for (const f of files) {
    if (!f.content) continue;
    zip.file(f.name, f.content.endsWith("\n") ? f.content : `${f.content}\n`);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "certificates.zip";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadYaml() {
  const blob = new Blob([k8sYaml.value], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${k8sSecretName.value}.yaml`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Clear ────────────────────────────────────────────────────────────────────
function clearAll() {
  leafCert.value = "";
  privateKey.value = "";
  intermediateChain.value = "";
  serverResult.value = null;
  errorMessage.value = "";
  copiedKey.value = null;
}

// ─── Build ────────────────────────────────────────────────────────────────────
async function buildFullchain() {
  errorMessage.value = ''
  serverResult.value = null
  loading.value = true

  try {
    const config = useRuntimeConfig();
    const secret = config.public.payloadSecret;

    const payload = encryptPayload(
      JSON.stringify({
        cert: certPem.value.trim(),
        key: keyPem.value?.trim() || "",
        chain: chainPem.value?.trim() || "",
      }),
      secret,
    );

    const response = await $fetch<any>("/api/fullchain", {
      method: "POST",
      body: { payload },
    });

    if (response && response.payload) {
      const decrypted = decryptPayload(response.payload, secret);
      if (decrypted) {
        serverResult.value = JSON.parse(decrypted);
      }
    } else {
      serverResult.value = response;
    }
  } catch (error: any) {
    errorMessage.value =
      error?.data?.statusMessage ||
      error?.data?.message ||
      error?.message ||
      "Request failed";
  } finally {
    loading.value = false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <header class="mb-8">
        <div
          class="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300"
        >
          SSL / TLS Utility
        </div>
        <h1 class="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
          Fullchain PEM Builder + Validator
        </h1>
        <p class="mt-4 max-w-4xl text-slate-300 text-lg leading-8">
          Upload certificate files, auto-build
          <code class="bg-slate-800 px-2 py-1 rounded">fullchain.pem</code>,
          validate the chain, verify key match, and export configs for
          Kubernetes, nginx, and Apache.
        </p>
      </header>

      <main class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section
          class="xl:col-span-2 rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl p-6 md:p-8"
        >
          <div class="space-y-8">
            <!-- Section title -->
            <div>
              <h2 class="text-2xl font-semibold flex items-center gap-2">
                <ShieldCheck class="w-6 h-6" />
                Upload certificate materials
              </h2>
              <p class="mt-2 text-slate-300 leading-7">
                Drag & drop or click to upload. If intermediate chain is
                missing, backend will try to fetch it from AIA URL.
              </p>
            </div>

            <!-- Leaf cert + Private key -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <!-- Leaf cert -->
              <div
                class="rounded-2xl border bg-slate-950 p-4 transition-colors"
                :class="
                  draggingOver === 'leaf'
                    ? 'border-cyan-500 bg-cyan-500/5'
                    : 'border-slate-800'
                "
                @dragover="onDragOver($event, 'leaf')"
                @dragleave="onDragLeave"
                @drop="onDrop($event, 'leaf')"
              >
                <div class="flex items-start gap-3 mb-4">
                  <div
                    class="rounded-xl bg-slate-900 p-2 border border-slate-800"
                  >
                    <FileText class="w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-slate-100">
                      Leaf certificate (.crt / .pem)
                    </h3>
                    <p class="text-sm text-slate-400 mt-1">
                      Required — drag & drop or upload
                    </p>
                  </div>
                </div>
                <label class="block">
                  <span
                    class="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm cursor-pointer hover:bg-slate-900 transition"
                  >
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
                  class="mt-4 w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm resize-none"
                  placeholder="Paste certificate content here."
                />
              </div>

              <!-- Private key -->
              <div
                class="rounded-2xl border bg-slate-950 p-4 transition-colors"
                :class="
                  draggingOver === 'key'
                    ? 'border-cyan-500 bg-cyan-500/5'
                    : 'border-slate-800'
                "
                @dragover="onDragOver($event, 'key')"
                @dragleave="onDragLeave"
                @drop="onDrop($event, 'key')"
              >
                <div class="flex items-start gap-3 mb-4">
                  <div
                    class="rounded-xl bg-slate-900 p-2 border border-slate-800"
                  >
                    <KeyRound class="w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-slate-100">
                      Private key (.key / .pem)
                    </h3>
                    <p class="text-sm text-slate-400 mt-1">
                      Optional — drag & drop or upload
                    </p>
                  </div>
                </div>
                <label class="block">
                  <span
                    class="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm cursor-pointer hover:bg-slate-900 transition"
                  >
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
                  class="mt-4 w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm resize-none"
                  placeholder="Paste private key content here."
                />
              </div>
            </div>

            <!-- Intermediate chain -->
            <div
              class="rounded-2xl border bg-slate-950 p-4 transition-colors"
              :class="
                draggingOver === 'chain'
                  ? 'border-cyan-500 bg-cyan-500/5'
                  : 'border-slate-800'
              "
              @dragover="onDragOver($event, 'chain')"
              @dragleave="onDragLeave"
              @drop="onDrop($event, 'chain')"
            >
              <div class="flex items-start gap-3 mb-4">
                <div
                  class="rounded-xl bg-slate-900 p-2 border border-slate-800"
                >
                  <Upload class="w-5 h-5" />
                </div>
                <div>
                  <h3 class="font-semibold text-slate-100">
                    Intermediate chain (.crt / .pem / .ca-bundle)
                  </h3>
                  <p class="text-sm text-slate-400 mt-1">
                    Optional — drag & drop or upload. Backend will try to
                    discover if omitted.
                  </p>
                </div>
              </div>
              <label class="block">
                <span
                  class="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm cursor-pointer hover:bg-slate-900 transition"
                >
                  <Upload class="w-4 h-4" />
                  Upload file
                </span>
                <input
                  type="file"
                  accept=".crt,.pem,.cer,.ca-bundle,text/plain"
                  class="hidden"
                  @change="handleFile($event, 'chain')"
                />
              </label>
              <textarea
                v-model="intermediateChain"
                rows="8"
                class="mt-4 w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm resize-none"
                placeholder="Paste one or more intermediate certificates here."
              />
            </div>

            <!-- Filenames -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label class="block text-sm font-medium text-slate-200 mb-2"
                  >cert filename</label
                >
                <input
                  v-model="certName"
                  class="w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-200 mb-2"
                  >fullchain filename</label
                >
                <input
                  v-model="fullchainName"
                  class="w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-200 mb-2"
                  >privkey filename</label
                >
                <input
                  v-model="privkeyName"
                  class="w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-200 mb-2"
                  >server filename</label
                >
                <input
                  v-model="combinedName"
                  class="w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap items-center gap-4">
              <button
                type="button"
                @click="buildFullchain"
                :disabled="loading || !certPem"
                class="rounded-2xl bg-cyan-500 text-slate-950 px-5 py-3 font-semibold hover:bg-cyan-400 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                <LoaderCircle v-if="loading" class="w-4 h-4 animate-spin" />
                Build and validate
              </button>

              <button
                type="button"
                @click="downloadAllZip"
                :disabled="!canDownloadAll"
                class="rounded-2xl border border-slate-700 px-5 py-3 font-semibold hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                <Archive class="w-4 h-4" />
                Download all (.zip)
              </button>

              <button
                type="button"
                @click="clearAll"
                class="rounded-2xl border border-slate-700 px-5 py-3 font-semibold hover:bg-slate-800 transition inline-flex items-center gap-2"
              >
                <Trash2 class="w-4 h-4" />
                Clear all
              </button>

              <div v-if="errorMessage" class="text-red-300 text-sm">
                {{ errorMessage }}
              </div>
            </div>

            <!-- Results -->
            <div
              v-if="serverResult"
              class="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3"
            >
              <!-- Cert info -->
              <div
                v-if="serverResult.certInfo"
                class="rounded-xl bg-slate-900 border border-slate-800 p-3 text-sm space-y-2"
              >
                <div class="text-slate-400 font-medium mb-1">
                  Certificate info
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                  <div>
                    <span class="text-slate-400">Subject: </span>
                    <span class="text-slate-100 break-all">{{
                      serverResult.certInfo.subject
                    }}</span>
                  </div>
                  <div>
                    <span class="text-slate-400">Issuer: </span>
                    <span class="text-slate-100 break-all">{{
                      serverResult.certInfo.issuer
                    }}</span>
                  </div>
                  <div>
                    <span class="text-slate-400">Valid from: </span>
                    <span class="text-slate-100">{{
                      formatDate(serverResult.certInfo.notBefore)
                    }}</span>
                  </div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-slate-400">Expires: </span>
                    <span class="text-slate-100">{{
                      formatDate(serverResult.certInfo.notAfter)
                    }}</span>
                    <span
                      class="px-2 py-0.5 rounded-full text-xs font-semibold"
                      :class="
                        serverResult.certInfo.isExpired
                          ? 'bg-red-500/20 text-red-300'
                          : serverResult.certInfo.daysLeft < 30
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-green-500/20 text-green-300'
                      "
                    >
                      {{
                        serverResult.certInfo.isExpired
                          ? "Expired"
                          : `${serverResult.certInfo.daysLeft}d left`
                      }}
                    </span>
                  </div>
                  <div class="md:col-span-2">
                    <span class="text-slate-400">SANs: </span>
                    <span class="text-slate-100 break-all">{{
                      serverResult.certInfo.sans.join(", ") || "None"
                    }}</span>
                  </div>
                </div>
              </div>

              <!-- Chain source + key match -->
              <div class="grid md:grid-cols-2 gap-4 text-sm">
                <div
                  class="rounded-xl bg-slate-900 border border-slate-800 p-3"
                >
                  <div class="text-slate-400">Intermediate source</div>
                  <div class="text-slate-100 mt-1">
                    {{ serverResult.chainSource || "unknown" }}
                  </div>
                </div>
                <div
                  class="rounded-xl bg-slate-900 border border-slate-800 p-3"
                >
                  <div class="text-slate-400">Cert / key match</div>
                  <div
                    class="mt-1"
                    :class="
                      serverResult.keyMatches === null
                        ? 'text-slate-400'
                        : serverResult.keyMatches
                          ? 'text-green-300'
                          : 'text-red-300'
                    "
                  >
                    {{
                      serverResult.keyMatches === null
                        ? "Not checked"
                        : serverResult.keyMatches
                          ? "✓ Matched"
                          : "✗ Not matched"
                    }}
                  </div>
                </div>
              </div>

              <!-- Verify output -->
              <div class="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <div class="flex items-center gap-2 mb-2">
                  <div class="text-slate-400">Chain verify output</div>
                  <span
                    class="px-2 py-0.5 rounded-full text-xs font-semibold"
                    :class="
                      serverResult.verifyOk
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    "
                  >
                    {{ serverResult.verifyOk ? "OK" : "Failed" }}
                  </span>
                </div>
                <pre class="text-xs whitespace-pre-wrap text-slate-200">{{
                  serverResult.verifyOutput
                }}</pre>
              </div>

              <!-- Warnings -->
              <div
                v-if="serverResult.warnings?.length"
                class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
              >
                <div class="font-semibold text-amber-200 mb-2">
                  <AlertTriangle class="w-4 h-4 inline mr-1" />
                  Warnings
                </div>
                <ul
                  class="list-disc list-inside text-sm text-amber-100 space-y-1"
                >
                  <li v-for="warning in serverResult.warnings" :key="warning">
                    {{ warning }}
                  </li>
                </ul>
              </div>
            </div>

            <!-- PEM Output panels -->
            <div class="flex flex-col gap-6">
              <PemPanel
                title="cert.pem"
                subtitle="Leaf certificate only"
                :filename="certName"
                :content="displayCertPem"
                :disabled="!displayCertPem"
                :copied="copiedKey === 'cert'"
                @copy="copyText(displayCertPem, 'cert')"
                @download="downloadText(certName, displayCertPem)"
              />
              <PemPanel
                title="fullchain.pem"
                subtitle="Leaf certificate + intermediate chain"
                :filename="fullchainName"
                :content="displayFullchainPem"
                :disabled="!displayFullchainPem"
                :copied="copiedKey === 'fullchain'"
                @copy="copyText(displayFullchainPem, 'fullchain')"
                @download="downloadText(fullchainName, displayFullchainPem)"
              />
              <PemPanel
                title="privkey.pem"
                subtitle="Private key only"
                :filename="privkeyName"
                :content="displayPrivkeyPem"
                :disabled="!displayPrivkeyPem"
                :copied="copiedKey === 'privkey'"
                @copy="copyText(displayPrivkeyPem, 'privkey')"
                @download="downloadText(privkeyName, displayPrivkeyPem)"
              />
              <PemPanel
                title="server.pem"
                subtitle="fullchain + private key"
                :filename="combinedName"
                :content="displayServerPem"
                :disabled="!displayServerPem"
                :copied="copiedKey === 'server'"
                @copy="copyText(displayServerPem, 'server')"
                @download="downloadText(combinedName, displayServerPem)"
              />
            </div>

            <!-- ── Kubernetes Secret YAML ───────────────────────────────── -->
            <div
              class="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4"
            >
              <div class="flex items-center gap-2">
                <Container class="w-5 h-5 text-cyan-400" />
                <h3 class="font-semibold text-slate-100">
                  Kubernetes TLS Secret
                </h3>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-300 mb-1"
                    >Secret name</label
                  >
                  <input
                    v-model="k8sSecretName"
                    class="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-300 mb-1"
                    >Namespace</label
                  >
                  <input
                    v-model="k8sNamespace"
                    class="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div class="relative">
                <pre
                  class="rounded-xl bg-slate-900 border border-slate-800 p-4 text-xs text-slate-300 overflow-x-auto whitespace-pre h-[220px] overflow-y-auto"
                  >{{ k8sYaml }}</pre
                >
                <div class="absolute top-3 right-3 flex gap-2">
                  <button
                    type="button"
                    @click="copySnippet(k8sYaml, 'k8s')"
                    class="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 transition inline-flex items-center gap-1"
                    :class="
                      copiedSnippet === 'k8s'
                        ? 'border-green-500/50 text-green-400'
                        : 'text-slate-300'
                    "
                  >
                    <Check v-if="copiedSnippet === 'k8s'" class="w-3 h-3" />
                    <Copy v-else class="w-3 h-3" />
                    {{ copiedSnippet === "k8s" ? "Copied!" : "Copy" }}
                  </button>
                  <button
                    type="button"
                    @click="downloadYaml"
                    class="rounded-lg bg-cyan-500 text-slate-950 px-2 py-1 text-xs font-semibold hover:bg-cyan-400 transition"
                  >
                    Download .yaml
                  </button>
                </div>
              </div>

              <p class="text-xs text-slate-500">
                Apply with:
                <code class="bg-slate-900 px-1.5 py-0.5 rounded"
                  >kubectl apply -f {{ k8sSecretName }}.yaml</code
                >
              </p>
            </div>

            <!-- ── nginx / Apache config snippets ─────────────────────── -->
            <div
              class="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4"
            >
              <div class="flex items-center gap-2">
                <Server class="w-5 h-5 text-cyan-400" />
                <h3 class="font-semibold text-slate-100">
                  Web server config snippets
                </h3>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-300 mb-1"
                    >Certificate path</label
                  >
                  <input
                    v-model="nginxCertPath"
                    class="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-300 mb-1"
                    >Private key path</label
                  >
                  <input
                    v-model="nginxKeyPath"
                    class="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  />
                </div>
              </div>

              <!-- nginx -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-slate-300">nginx</span>
                  <button
                    type="button"
                    @click="copySnippet(nginxSnippet, 'nginx')"
                    class="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 transition inline-flex items-center gap-1"
                    :class="
                      copiedSnippet === 'nginx'
                        ? 'border-green-500/50 text-green-400'
                        : 'text-slate-300'
                    "
                  >
                    <Check v-if="copiedSnippet === 'nginx'" class="w-3 h-3" />
                    <Copy v-else class="w-3 h-3" />
                    {{ copiedSnippet === "nginx" ? "Copied!" : "Copy" }}
                  </button>
                </div>
                <pre
                  class="rounded-xl bg-slate-900 border border-slate-800 p-4 text-xs text-slate-300 overflow-x-auto whitespace-pre"
                  >{{ nginxSnippet }}</pre
                >
              </div>

              <!-- Apache -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-slate-300">Apache</span>
                  <button
                    type="button"
                    @click="copySnippet(apacheSnippet, 'apache')"
                    class="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 transition inline-flex items-center gap-1"
                    :class="
                      copiedSnippet === 'apache'
                        ? 'border-green-500/50 text-green-400'
                        : 'text-slate-300'
                    "
                  >
                    <Check v-if="copiedSnippet === 'apache'" class="w-3 h-3" />
                    <Copy v-else class="w-3 h-3" />
                    {{ copiedSnippet === "apache" ? "Copied!" : "Copy" }}
                  </button>
                </div>
                <pre
                  class="rounded-xl bg-slate-900 border border-slate-800 p-4 text-xs text-slate-300 overflow-x-auto whitespace-pre"
                  >{{ apacheSnippet }}</pre
                >
              </div>
            </div>
          </div>
        </section>

        <!-- Sidebar -->
        <aside
          class="rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl p-6 space-y-6"
        >
          <div>
            <h3 class="text-xl font-semibold">Important</h3>
            <p class="mt-2 text-slate-300 leading-7 text-sm">
              <code class="bg-slate-950 px-1.5 py-0.5 rounded"
                >.crt + .key</code
              >
              does not automatically mean you have a valid fullchain. A proper
              public TLS chain usually needs the intermediate CA certificate
              too.
            </p>
          </div>

          <div>
            <h4 class="font-semibold text-slate-100">Expected outputs</h4>
            <ul
              class="mt-2 space-y-2 text-sm text-slate-300 list-disc list-inside"
            >
              <li><strong>cert.pem</strong>: leaf cert only</li>
              <li><strong>fullchain.pem</strong>: leaf + intermediate(s)</li>
              <li><strong>privkey.pem</strong>: private key only</li>
              <li><strong>server.pem</strong>: fullchain + private key</li>
            </ul>
          </div>

          <div class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <h4 class="font-semibold text-slate-100">Kubernetes</h4>
            <div class="mt-3 space-y-3 text-sm text-slate-300">
              <code class="block rounded-xl bg-slate-900 p-3 overflow-x-auto"
                >tls.crt = fullchain.pem</code
              >
              <code class="block rounded-xl bg-slate-900 p-3 overflow-x-auto"
                >tls.key = privkey.pem</code
              >
            </div>
          </div>

          <div
            class="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300 space-y-2"
          >
            <h4 class="font-semibold text-slate-100">Drag & drop tips</h4>
            <p>
              Each input zone accepts drag & drop. Drop directly onto the card —
              it highlights in cyan when active.
            </p>
          </div>

          <div
            class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100"
          >
            <div class="flex items-start gap-3">
              <AlertTriangle class="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p class="font-semibold">Reality check</p>
                <p class="mt-1 text-sm leading-6">
                  Some certificates do not expose a usable AIA URL, and some
                  chains require multiple intermediates. Auto-fetch improves
                  results but is not guaranteed to fully solve every CA chain.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  </div>
</template>
