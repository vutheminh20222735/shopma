import test from 'node:test';
import assert from 'node:assert/strict';
import { getSizeRecommendation } from '../features/products/size-recommendation.ts';
import { simulateOfferImpact } from '../features/offers/offer-simulator.ts';

const product = {
  id: 'size-demo',
  category: 'Áo thun',
  sizes: ['S', 'M', 'L', 'XL'],
  variants: [
    { size: 'S', stock: 4 },
    { size: 'M', stock: 6 },
    { size: 'L', stock: 3 },
    { size: 'XL', stock: 2 }
  ],
  measurements: {
    chest: { S: 85, M: 93, L: 101, XL: 109 },
    height: { S: 160, M: 168, L: 176, XL: 184 }
  }
};

test('size recommendation chooses vertical size and returns rationale', () => {
  const recommendation = getSizeRecommendation(product, {
    heightCm: 170,
    weightKg: 62,
    fit: 'vừa',
    chestCm: 92,
    shoulderCm: 40,
    notes: 'Mặc áo khoác ngoài'
  });

  assert.equal(recommendation.recommendedSize, 'M');
  assert.match(recommendation.reason, /vừa|M/);
  assert.ok(recommendation.alternatives.length >= 1);
});

test('offer simulation calculates totals and warns low profitability', () => {
  const simulation = simulateOfferImpact({
    items: [
      { name: 'Áo thun', quantity: 1, price: 249000, cost: 120000 },
      { name: 'Quần jean', quantity: 1, price: 599000, cost: 280000 }
    ],
    shipping: 30000,
    paymentFee: 15000,
    packaging: 10000,
    otherCost: 20000,
    discount: 120000,
    campaign: { name: 'MUA 2 GIẢM 10%', maxBudget: 3500000, usedBudget: 800000 }
  });

  assert.ok(simulation.revenueAfterDiscount > 0);
  assert.equal(simulation.discountAmount, 120000);
  assert.ok(simulation.profit >= 0 || simulation.warnings.some((w) => w.includes('lợi nhuận')));
});
