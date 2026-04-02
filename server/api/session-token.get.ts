import { defineEventHandler, setCookie, getCookie } from "h3";
import { randomBytes } from "node:crypto";

// Replaces the broken crypto-public.get.ts (which tried to read a missing RSA key file).
//
// How it works:
//  1. On first visit the server generates a random 256-bit session token.
//  2. The token is stored in an HttpOnly, SameSite=Strict cookie so the browser
//     cannot read it via JS — only sends it back on subsequent requests.
//  3. The same token is returned in the JSON body so the page can use it
//     to AES-encrypt the request payload and decrypt the response.
//  4. Because the token is also in the cookie, the server can look it up
//     on /api/fullchain to verify it matches before decrypting.
//
// This is a lightweight "poor-man's session key" approach that keeps the
// shared secret off the Nuxt public bundle without needing RSA keypairs.

const COOKIE_NAME = "ssl_session";
const COOKIE_MAX_AGE = 60 * 60 * 2; // 2 hours

export default defineEventHandler((event) => {
  // Reuse existing session token if the cookie is already set
  const existing = getCookie(event, COOKIE_NAME);
  if (existing && existing.length === 64) {
    return { token: existing };
  }

  // Generate a new 256-bit (32-byte) random hex token
  const token = randomBytes(32).toString("hex");

  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return { token };
});
