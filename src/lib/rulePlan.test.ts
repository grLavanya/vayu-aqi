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
});
