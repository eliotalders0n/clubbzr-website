const assert = require("node:assert/strict");
const test = require("node:test");

const {
  fromMinorUnits,
  moneyEquals,
  sumMoney,
  toMinorUnits,
} = require("../lib/payments/money");

test("money is normalized to integer minor units", () => {
  assert.equal(toMinorUnits("100.50"), 10050);
  assert.equal(toMinorUnits(0.1 + 0.2), 30);
  assert.equal(fromMinorUnits(10050), 100.5);
});

test("money totals do not accumulate floating point drift", () => {
  assert.equal(sumMoney([0.1, 0.2, 100.2], (value) => value), 100.5);
});

test("money comparisons happen at currency precision", () => {
  assert.equal(moneyEquals("100.50", 100.5), true);
  assert.equal(moneyEquals("100.50", 100.51), false);
});
