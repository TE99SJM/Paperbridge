const encoder = new TextEncoder(), decoder = new TextDecoder();
const ITERATIONS = 310000;
function to64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
function from64(s) {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function derive(password, salt, iterations) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
export async function createVaultKey(password) {
  if (password.length < 12) throw new Error("Use a passphrase of at least 12 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await derive(password, salt, ITERATIONS), salt: to64(salt), iterations: ITERATIONS };
}
export async function sealVault(value, keyInfo) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode("Paperbridge/vault/1") },
    keyInfo.key, encoder.encode(JSON.stringify(value))
  );
  return { version: 1, salt: keyInfo.salt, iterations: keyInfo.iterations, iv: to64(iv), data: to64(new Uint8Array(ciphertext)) };
}
export async function openVault(blob, password) {
  if (blob?.version !== 1 || !Number.isInteger(blob.iterations) || blob.iterations < 100000 || blob.iterations > 1000000 ||
      typeof blob.data !== "string" || blob.data.length > 13000000) throw new Error("Unsupported or damaged vault.");
  try {
    const salt = from64(blob.salt), iv = from64(blob.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error("Invalid envelope");
    const key = await derive(password, salt, blob.iterations);
    const clear = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode("Paperbridge/vault/1") },
      key, from64(blob.data)
    );
    const value = JSON.parse(decoder.decode(clear));
    if (value.schema !== 1 || !Array.isArray(value.documents) || !value.settings) throw new Error("Invalid vault");
    return { value, keyInfo: { key, salt: blob.salt, iterations: blob.iterations } };
  } catch {
    throw new Error("The passphrase is incorrect, or the vault is damaged. There is no password-reset backdoor.");
  }
}
