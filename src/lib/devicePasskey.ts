const PASSKEY_STORAGE_KEY = "genaia-device-passkey";
export const DEVICE_UNLOCK_KEY = "genaia-device-unlocked";

type StoredPasskey = {
  credentialId: string;
  enabledAt: string;
};

const toBase64Url = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const randomBytes = (length = 32) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

export const isDevicePasskeySupported = () =>
  typeof window !== "undefined" &&
  typeof PublicKeyCredential !== "undefined" &&
  typeof navigator.credentials?.create === "function" &&
  typeof navigator.credentials?.get === "function";

export const hasDevicePasskey = () => {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(PASSKEY_STORAGE_KEY);
};

export const markDeviceUnlocked = () => {
  sessionStorage.setItem(DEVICE_UNLOCK_KEY, "1");
};

export const clearDeviceUnlock = () => {
  sessionStorage.removeItem(DEVICE_UNLOCK_KEY);
};

export const isDeviceUnlocked = () => sessionStorage.getItem(DEVICE_UNLOCK_KEY) === "1";

export const registerDevicePasskey = async (userLabel: string) => {
  if (!isDevicePasskeySupported()) throw new Error("Este dispositivo o navegador no soporta Face ID / Touch ID para esta app.");

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(),
      rp: { name: "GENAIA" },
      user: {
        id: randomBytes(16),
        name: userLabel || "GENAIA",
        displayName: userLabel || "GENAIA",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    },
  });

  if (!(credential instanceof PublicKeyCredential)) throw new Error("No se pudo crear la passkey del dispositivo.");

  const stored: StoredPasskey = {
    credentialId: toBase64Url(credential.rawId),
    enabledAt: new Date().toISOString(),
  };
  localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(stored));
  markDeviceUnlocked();
};

export const authenticateDevicePasskey = async () => {
  if (!isDevicePasskeySupported()) throw new Error("Este dispositivo o navegador no soporta Face ID / Touch ID para esta app.");

  const raw = localStorage.getItem(PASSKEY_STORAGE_KEY);
  if (!raw) throw new Error("Face ID / Touch ID no está activado en este dispositivo.");

  const stored = JSON.parse(raw) as StoredPasskey;
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(),
      allowCredentials: [
        {
          id: fromBase64Url(stored.credentialId),
          type: "public-key",
        },
      ],
      userVerification: "required",
      timeout: 60000,
    },
  });

  if (!(assertion instanceof PublicKeyCredential)) throw new Error("No se pudo validar Face ID / Touch ID.");
  markDeviceUnlocked();
};

export const clearDevicePasskey = () => {
  localStorage.removeItem(PASSKEY_STORAGE_KEY);
  clearDeviceUnlock();
};
