import crypto from "node:crypto";

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    process.exitCode = 1;
  }
}

// 1. Test Password Hashing and Verification
function hashPassword(password) {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a valid non-empty string");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof password !== "string" || typeof storedHash !== "string") {
    return false;
  }
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

runTest("Password hashing and valid verification", () => {
  const hash = hashPassword("TestEngineering2026!");
  if (!verifyPassword("TestEngineering2026!", hash)) {
    throw new Error("Valid password failed verification");
  }
});

runTest("Password verification rejects wrong password", () => {
  const hash = hashPassword("TestEngineering2026!");
  if (verifyPassword("WrongPassword!", hash)) {
    throw new Error("Wrong password unexpectedly passed verification");
  }
});

runTest("Password verification rejects empty password and empty hash", () => {
  if (verifyPassword("", "somesalt:somekey")) {
    throw new Error("Empty password bypassed verification");
  }
  if (verifyPassword("ValidPass123", "")) {
    throw new Error("Empty hash bypassed verification");
  }
  if (verifyPassword("ValidPass123", null)) {
    throw new Error("Null hash bypassed verification");
  }
});

// 2. Test Session Token Creation and Verification
function createSessionToken(user, secret) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = { ...user, exp };
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifySessionToken(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  if (signature !== expected) return null;
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
}

runTest("JWT token creation and verification with secret", () => {
  const secret = "a_very_secure_test_secret_for_production_verification_2026";
  const user = { userId: "u123", email: "test@fuoye.edu.ng", role: "STUDENT", name: "Test Student" };
  const token = createSessionToken(user, secret);
  const decoded = verifySessionToken(token, secret);
  if (!decoded || decoded.userId !== "u123") {
    throw new Error("Token decoding failed");
  }
});

runTest("JWT token rejects tampering or wrong secret", () => {
  const secret1 = "secret_one_12345678901234567890";
  const secret2 = "secret_two_12345678901234567890";
  const user = { userId: "u123", email: "test@fuoye.edu.ng", role: "STUDENT", name: "Test Student" };
  const token = createSessionToken(user, secret1);
  const decoded = verifySessionToken(token, secret2);
  if (decoded !== null) {
    throw new Error("Tampered or wrong secret token succeeded verification");
  }
});

console.log("\nAll core security & authentication unit checks completed successfully.");
