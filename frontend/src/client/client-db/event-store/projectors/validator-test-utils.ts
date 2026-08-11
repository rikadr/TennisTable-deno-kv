import { ValidatorResponse } from "./validator-types";

// Test-only helper: narrows a validator result so the failure message can be
// read type-safely. It lives outside __tests__ because CRA runs every file in
// that directory as a test suite, and a helper file has no tests to run.
export function expectInvalid(response: ValidatorResponse): asserts response is { valid: false; message: string } {
  expect(response.valid).toBe(false);
}
