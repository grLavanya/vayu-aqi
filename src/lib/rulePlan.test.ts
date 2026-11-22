import { describe, expect, it } from 'vitest';
import { generateRulePlan } from './rulePlan';

describe('rulePlan fallback generator', () => {
  it('produces a full schema conforming plan', () => {
    const plan = generateRulePlan({ aqi: 150 });
    expect(plan.summary).toBeTruthy();
    expect(plan.morning.length).toBeGreaterThanOrEqual(2);
    expect(plan.afternoon.length).toBeGreaterThanOrEqual(2);
    expect(plan.evening.length).toBeGreaterThanOrEqual(2);
    expect(plan.indoor).toHaveLength(3);
    expect(plan.swaps).toHaveLength(3);
    expect(plan.planSource).toBe('rules');
  });

  it('produces visibly different output for different chips', () => {
    const commuterPlan = generateRulePlan({ aqi: 150, chips: ['dailyCommuter'] });
    const childrenPlan = generateRulePlan({ aqi: 150, chips: ['youngChildren'] });
    const seniorPlan = generateRulePlan({ aqi: 150, chips: ['seniorAtHome'] });

    // Daily commuter includes transit/commute guidance
    const commuterTitles = commuterPlan.evening.map((a) => a.title).join(' ');
    expect(commuterTitles.toLowerCase()).toContain('commute');

    // Young children includes children guidance
    const childrenTitles = childrenPlan.morning.map((a) => a.title).join(' ');
    expect(childrenTitles.toLowerCase()).toContain('little ones');

    // Senior at home includes elder guidance
    const seniorTitles = seniorPlan.afternoon.map((a) => a.title).join(' ');
    expect(seniorTitles.toLowerCase()).toContain('garden');
  });

  it('provides a safety note on heavy/dense days when children or seniors are present', () => {
    const safePlan = generateRulePlan({ aqi: 45, chips: ['youngChildren'] });
    expect(safePlan.safetyNote).toBeNull();

    const heavyWithChildren = generateRulePlan({ aqi: 260, chips: ['youngChildren'] });
    expect(heavyWithChildren.safetyNote).toBeTruthy();
    expect(heavyWithChildren.safetyNote?.toLowerCase()).toContain('doctor');

    const denseWithSenior = generateRulePlan({ aqi: 350, chips: ['seniorAtHome'] });
    expect(denseWithSenior.safetyNote).toBeTruthy();
  });

  // ─── Swap relevance tests ──────────────────────────────────────────────────

  describe('swap relevance by chip', () => {
    it('gives commuter swaps only when dailyCommuter chip is present', () => {
      const commuter = generateRulePlan({ aqi: 200, chips: ['dailyCommuter'] });
      const allTitles = commuter.swaps.map((s) => s.title.toLowerCase()).join(' ');
      // Commuter swaps mention transit / metro / bus / two-wheeler / engine
      expect(
        allTitles.includes('metro') ||
          allTitles.includes('bus') ||
          allTitles.includes('two-wheeler') ||
          allTitles.includes('engine')
      ).toBe(true);
    });

    it('does NOT give commuter swaps without dailyCommuter chip', () => {
      const noPlan = generateRulePlan({ aqi: 200, chips: ['youngChildren'] });
      const allTitles = noPlan.swaps.map((s) => s.title.toLowerCase()).join(' ');
      expect(allTitles.includes('metro') || allTitles.includes('two-wheeler')).toBe(false);
    });

    it('gives purifier swaps when hasPurifier chip is present and no commuter chip', () => {
      const purifier = generateRulePlan({ aqi: 200, chips: ['hasPurifier'] });
      const allTitles = purifier.swaps.map((s) => s.title.toLowerCase()).join(' ');
      expect(allTitles.includes('purifier')).toBe(true);
    });

    it('gives children-specific swaps when youngChildren chip is present (no commuter/purifier)', () => {
      const children = generateRulePlan({ aqi: 200, chips: ['youngChildren'] });
      const allText = children.swaps.map((s) => `${s.title} ${s.why} ${s.impact}`).join(' ').toLowerCase();
      // Children swaps mention outdoor play, floor cleaning, or cooking
      expect(
        allText.includes('play') || allText.includes('mop') || allText.includes('cooking')
      ).toBe(true);
    });

    it('gives senior-specific swaps when seniorAtHome chip is present (no higher-priority chip)', () => {
      const senior = generateRulePlan({ aqi: 200, chips: ['seniorAtHome'] });
      const allText = senior.swaps.map((s) => `${s.title} ${s.why} ${s.impact}`).join(' ').toLowerCase();
      // Senior swaps mention morning walk, cleaning, or errands timing
      expect(
        allText.includes('walk') || allText.includes('dust') || allText.includes('errands')
      ).toBe(true);
    });

    it('gives general household swaps when no chip is selected', () => {
      const general = generateRulePlan({ aqi: 150 });
      const allText = general.swaps.map((s) => `${s.title} ${s.why} ${s.impact}`).join(' ').toLowerCase();
      // General swaps mention burning, mopping, or chimney/cooking
      expect(
        allText.includes('burning') || allText.includes('mop') || allText.includes('chimney')
      ).toBe(true);
    });

    it('no swap text contains a percentage or numeric reduction figure', () => {
      const chips = ['dailyCommuter', 'hasPurifier', 'youngChildren', 'seniorAtHome', 'studentSports'];
      for (const chip of chips) {
        const plan = generateRulePlan({ aqi: 250, chips: [chip] });
        for (const swap of plan.swaps) {
          const combined = `${swap.title} ${swap.why} ${swap.impact}`;
          expect(combined).not.toMatch(/%|percent|per cent|kilogram|\bkg\b|litre|liter|times more|times less|\bfold\b/i);
        }
      }
    });
  });
});
