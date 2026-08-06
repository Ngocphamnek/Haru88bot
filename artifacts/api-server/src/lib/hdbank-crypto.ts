import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = path.join(__dirname, "../vendor/hdbank");

let _cryptoJs: string | null = null;

function getCryptoJs(): string {
  if (_cryptoJs) return _cryptoJs;
  const rsaPath = path.join(VENDOR_DIR, "rsa.js");
  const bfPath = path.join(VENDOR_DIR, "ecbblowfish.js");
  if (!fs.existsSync(rsaPath) || !fs.existsSync(bfPath)) {
    throw new Error(
      "HDBank vendor scripts missing (src/vendor/hdbank/rsa.js + ecbblowfish.js). " +
      "Add the bank client crypto files or disable HDBank integration.",
    );
  }
  const rsaJs = fs.readFileSync(rsaPath, "utf-8");
  const bfJs = fs.readFileSync(bfPath, "utf-8");
  _cryptoJs = rsaJs + "\n" + bfJs;
  return _cryptoJs;
}

interface EcbBlowfishContext {
  applet: {
    setCryptoKeyLength(len: string): void;
    setKey(key: string): void;
    getEncryptedKey(): string;
    getSymmetricKey(): string;
    encrypt(str: string): string;
    encryptWithRSA(modulus: string, plaintext: string): string;
  };
  ecbblowfish: new () => EcbBlowfishContext["applet"];
  Math: typeof Math;
  String: typeof String;
  Array: typeof Array;
  parseInt: typeof parseInt;
  parseFloat: typeof parseFloat;
  isNaN: typeof isNaN;
  Number: typeof Number;
  BigInteger: unknown;
  SecureRandom: unknown;
  RSAKey: unknown;
  Blowfish: unknown;
  ecb: unknown;
  ecbblowfish_: unknown;
}

function createContext(): vm.Context {
  const ctx: Record<string, unknown> = {
    Math,
    String,
    Array,
    parseInt,
    parseFloat,
    isNaN,
    Number,
    console,
    alert: () => {},
    window: undefined as unknown,
    self: undefined as unknown,
    parent: undefined as unknown,
    document: undefined as unknown,
    navigator: { appName: "Netscape", userAgent: "Mozilla/5.0" },
    location: { href: "https://ebanking.hdbank.vn/" },
  };
  ctx["window"] = ctx;
  ctx["self"] = ctx;
  return vm.createContext(ctx);
}

export interface HDBankCrypto {
  symmetricKey: string;
  encryptedKey: string;
  encryptPassword(password: string): string;
  encryptWithRSA(modulus: string, text: string): string;
}

/**
 * Initialize HD Bank crypto with server's public key.
 * Returns symmetric key, encrypted key (to send as private_key),
 * and a function to encrypt the password.
 */
export function initHDBankCrypto(serverPublicKey: string): HDBankCrypto {
  const ctx = createContext();
  const js = getCryptoJs();
  vm.runInContext(js, ctx);

  const context = ctx as Record<string, unknown>;
  const EcbBlowfish = context["ecbblowfish"] as new () => {
    setCryptoKeyLength(len: string): void;
    setKey(key: string): void;
    getEncryptedKey(): string;
    getSymmetricKey(): string;
    encrypt(str: string): string;
    encryptWithRSA(modulus: string, text: string): string;
  };

  const applet = new EcbBlowfish();
  applet.setCryptoKeyLength("168");
  applet.setKey(serverPublicKey);

  const symmetricKey = applet.getSymmetricKey();
  const encryptedKey = applet.getEncryptedKey();

  return {
    symmetricKey,
    encryptedKey,
    encryptPassword: (password: string) => applet.encrypt(password),
    encryptWithRSA: (modulus: string, text: string) => applet.encryptWithRSA(modulus, text),
  };
}
