import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { validateAuthConfig } from "./env.js";
import { generateToken } from "../utils/generateToken.js";

test("rejects absent, empty and example signing secrets", () => {
  for (const JWT_SECRET of [undefined, "", "   ", "change_this_to_a_long_random_secret"]) {
    assert.throws(() => validateAuthConfig({ JWT_SECRET }), /JWT_SECRET must be configured/);
  }
});

test("configured secret signs a token that authentication can verify", () => {
  const previous = process.env.JWT_SECRET;
  try {
    process.env.JWT_SECRET = "test-only-secret-for-auth-regression-check";
    validateAuthConfig();
    const token = generateToken("customer-test-id");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(decoded.id, "customer-test-id");
    assert.ok(decoded.exp > decoded.iat);
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});
