import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAnimeTouchSound,
  normalizeThemeMode,
  toggleThemeMode,
} from './themeAudio';

describe('themeAudio pure helpers', () => {
  it('normalizes and toggles between normal and dark theme modes cleanly', () => {
    assert.equal(normalizeThemeMode(null), 'normal');
    assert.equal(normalizeThemeMode('light'), 'normal');
    assert.equal(normalizeThemeMode('dark'), 'dark');
    assert.equal(toggleThemeMode('normal'), 'dark');
    assert.equal(toggleThemeMode('dark'), 'normal');
  });

  it('classifies every UI interaction into the matching anime SFX type', () => {
    assert.equal(classifyAnimeTouchSound('Order bhejo · ₹140', 'btn big', 'button'), 'confirm');
    assert.equal(classifyAnimeTouchSound('Add', 'add-outline-btn', 'button'), 'add');
    assert.equal(classifyAnimeTouchSound('Waiter Bulao', 'quick-help-card', 'button'), 'alert');
    assert.equal(classifyAnimeTouchSound('Aa raha hu', 'btn btn-sm staff-call-resolve-btn', 'button'), 'alert');
    assert.equal(classifyAnimeTouchSound('Cancel', 'chip', 'button'), 'back');
    assert.equal(classifyAnimeTouchSound('Band karo', 'sheet-close', 'button'), 'back');
    assert.equal(classifyAnimeTouchSound('T5 QR', 'guest-qr-btn', 'button'), 'tab');
    assert.equal(classifyAnimeTouchSound('Floor', 'nav-link', 'a'), 'tab');
    assert.equal(classifyAnimeTouchSound('', '', 'div'), 'tap');
  });
});
