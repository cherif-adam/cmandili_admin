import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MONEY_STEP,
  formatMoneyStep,
  parseMoneyStep,
} from "./money-step.ts";

test("le pas par défaut est 50 millimes", () => {
  assert.equal(DEFAULT_MONEY_STEP, 0.05);
  assert.equal(formatMoneyStep(DEFAULT_MONEY_STEP), "0.050");
});

test("accepte un pas en millimes entiers, nombre ou texte, virgule comprise", () => {
  assert.equal(parseMoneyStep(0.05), 0.05);
  assert.equal(parseMoneyStep("0.050"), 0.05);
  assert.equal(parseMoneyStep("0,1"), 0.1);
  assert.equal(parseMoneyStep(" 0.5 "), 0.5);
  assert.equal(parseMoneyStep(0.001), 0.001);
  assert.equal(parseMoneyStep(1), 1);
});

test("refuse zéro, le négatif, le hors borne et le non-nombre", () => {
  for (const bad of [0, -0.05, 0.0005, 1.001, 2, "", "abc", null, undefined, NaN, Infinity]) {
    assert.equal(parseMoneyStep(bad), null, `devrait refuser ${String(bad)}`);
  }
});

test("refuse un pas qui n'est pas fait de millimes entiers", () => {
  assert.equal(parseMoneyStep(0.0505), null);
  assert.equal(parseMoneyStep("0.0125"), null);
});

test("formatMoneyStep écrit toujours 3 décimales", () => {
  assert.equal(formatMoneyStep(0.1), "0.100");
  assert.equal(formatMoneyStep(1), "1.000");
  assert.equal(formatMoneyStep(0.005), "0.005");
});
