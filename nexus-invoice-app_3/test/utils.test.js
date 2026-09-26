const test = require('node:test');
const assert = require('node:assert');
const { numberToWordsUSD } = require('../server/utils');

test('whole dollar amounts', () => {
  assert.strictEqual(numberToWordsUSD(0), 'USD ZERO ONLY');
  assert.strictEqual(numberToWordsUSD(1250), 'USD ONE THOUSAND TWO HUNDRED FIFTY ONLY');
  assert.strictEqual(numberToWordsUSD(150000), 'USD ONE LAKH FIFTY THOUSAND ONLY');
});

test('cents', () => {
  assert.strictEqual(numberToWordsUSD(12.5), 'USD TWELVE AND CENTS FIFTY ONLY');
  assert.strictEqual(numberToWordsUSD(0.29), 'USD ZERO AND CENTS TWENTY NINE ONLY');
});

test('rounding up to a whole dollar never yields "CENTS ONE HUNDRED"', () => {
  assert.strictEqual(numberToWordsUSD(10.999), 'USD ELEVEN ONLY');
});
