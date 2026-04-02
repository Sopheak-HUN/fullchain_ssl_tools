# 🔐 Fullchain PEM Builder + Validator

A powerful and user-friendly web utility built with **Nuxt 3** to manage, validate, and build SSL/TLS certificate chains. ✨

Often, obtaining an SSL certificate yields a `.crt` and a `.key` file, but many servers (like nginx, Apache) or orchestration platforms (like Kubernetes) require a proper `fullchain.pem` containing both the leaf certificate and the associated intermediate CA certificates. This tool automates the process of diagnosing missing intermediates, building the fullchain, checking if the private key matches, and generating ready-to-use configuration snippets. 🚀

## ✨ Features

- 🏗️ **Auto-Build Fullchain:** Upload your leaf certificate, and the backend will intelligently attempt to fetch missing intermediate certificates via AIA (Authority Information Access) to assemble a proper fullchain.
- ✅ **Key Matching & Validation:** Automatically verifies that your provided private key matches the leaf certificate, and performs OpenSSL-like validation of the assembled certificate chain.
- 🔍 **Certificate Inspection:** Extracts and displays useful information from the certificate block, such as Subject, Issuer, Validity periods (including a days-remaining indicator), and Subject Alternative Names (SANs) coverage.
- 📄 **Multiple Formats Support:** Generates and standardizes output for `cert.pem` (leaf), `fullchain.pem` (leaf + chain), `privkey.pem` (key), and `server.pem` (fullchain + key).
- 🖱️ **Drag & Drop UI:** Streamlined interface to effortlessly load `.crt`, `.pem`, `.ca-bundle`, and `.key` files by dragging them directly onto the web interface.
- ☸️ **Kubernetes Ready:** Dynamically generates a ready-to-apply Kubernetes `kubernetes.io/tls` Secret YAML file.
- ⚙️ **Web Server Snippets:** Provides instant, copy-paste configuration snippets pointing to the correct PEM paths for both **nginx** and **Apache**.
- 📦 **Bulk Export:** Option to securely zip and download all the generated certificate PEM files at once.

## 🛡️ Privacy & Security Note

This application handles highly sensitive SSL/TLS materials, particularly **Private Keys**. 

If you are using or deploying this tool:
- 💻 **Local First:** For maximum security with production private keys, build and run this tool exclusively on your local machine (`localhost`).
- 🏢 **Internal Deployment:** If hosting for a team, place it behind a VPN or strong access controls (like mutual TLS or SSO), and ensure traffic is strictly encrypted over HTTPS.
- 🚫 **Zero Data Storage:** All uploaded data (certificates, keys, etc.) is processed purely in memory for immediate evaluation. Absolutely **no data is stored**, saved to disk, logged, or kept in any database.
- 🗑️ Data sent to the `/api/fullchain` backend route is processed temporarily and discarded immediately after returning the result. Treat the server environment with standard security precautions.
