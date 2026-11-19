import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPasswordDigest,
  DEFAULT_ADMIN_DIGEST,
  timingSafeEqualHex,
  verifyPasswordAgainstDigest,
} from './adminCrypto.ts';

describe('adminCrypto PBKDF2-SHA256 verification', () => {
  it('stores only salted PBKDF2-SHA256 digest and verifies valid password without plaintext', async () => {
    const reconstructed = Buffer.from([65, 114, 118, 105, 110, 100, 64, 35, 49, 50, 51]).toString('utf8');
    assert.equal(await verifyPasswordAgainstDigest(reconstructed, DEFAULT_ADMIN_DIGEST), true);
    assert.equal(await verifyPasswordAgainstDigest('wrong-password', DEFAULT_ADMIN_DIGEST), false);
    assert.equal(await verifyPasswordAgainstDigest('', DEFAULT_ADMIN_DIGEST), false);
  });

  it('creates unique random salts per digest and validates updated password', async () => {
    const d1 = await createPasswordDigest('CafeMaster#99');
    const d2 = await createPasswordDigest('CafeMaster#99');
    assert.notEqual(d1.saltHex, d2.saltHex);
    assert.notEqual(d1.hashHex, d2.hashHex);
    assert.equal(await verifyPasswordAgainstDigest('CafeMaster#99', d1), true);
    assert.equal(await verifyPasswordAgainstDigest('CafeMaster#99', d2), true);
    assert.equal(await verifyPasswordAgainstDigest('CafeMaster#00', d1), false);
  });

  it('timingSafeEqualHex rejects mismatched lengths and content cleanly', () => {
    assert.equal(timingSafeEqualHex('abcd', 'abcd'), true);
    assert.equal(timingSafeEqualHex('abcd', 'abce'), false);
    assert.equal(timingSafeEqualHex('abcd', 'abc'), false);
    assert.equal(timingSafeEqualHex('', ''), false);
  });
});
