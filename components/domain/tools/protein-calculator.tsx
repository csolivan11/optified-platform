"use client";

import { useState } from "react";
import { Award } from "lucide-react";
import {
  CalculatorCard,
  CalcInput,
  CalcResult,
} from "./calculator-card";

/**
 * Lean-mass-based protein targets aligned with the longevity literature:
 *   minimum:    1.6 g per kg lean mass  (sufficient for older adults to
 *                                        prevent sarcopenia)
 *   optimal:    2.2 g per kg lean mass  (body recomp + active aging)
 *   athletic:   2.5 g per kg lean mass  (heavy training + recovery)
 *
 * Bodyweight + body fat % → lean mass.
 */
export function ProteinCalculator() {
  const [weightLbs, setWeightLbs] = useState("180");
  const [bodyFatPct, setBodyFatPct] = useState("18");

  const w = Number(weightLbs);
  const bf = Number(bodyFatPct);
  const valid = w > 0 && bf >= 5 && bf <= 60;

  const leanLbs = valid ? w * (1 - bf / 100) : 0;
  const leanKg = leanLbs * 0.453592;

  const minProtein = valid ? Math.round(leanKg * 1.6) : null;
  const optProtein = valid ? Math.round(leanKg * 2.2) : null;
  const athProtein = valid ? Math.round(leanKg * 2.5) : null;

  // 6 oz of cooked chicken breast ≈ 50g protein
  const chickenServings =
    optProtein !== null ? Math.round(optProtein / 50) : null;

  return (
    <CalculatorCard
      title="Protein Requirement"
      description="Lean-mass-based daily targets for active aging."
      icon={Award}
    >
      <div className="grid grid-cols-2 gap-3 mt-4">
        <CalcInput
          label="Bodyweight"
          value={weightLbs}
          onChange={setWeightLbs}
          unit="lbs"
        />
        <CalcInput
          label="Body fat %"
          value={bodyFatPct}
          onChange={setBodyFatPct}
          unit="%"
          min={5}
          max={60}
        />
      </div>

      {valid && (
        <div className="mt-5 space-y-1">
          <CalcResult
            label="Lean mass"
            value={leanLbs.toFixed(1)}
            unit="lbs"
          />
          <CalcResult
            label="Optimal target (recomp)"
            value={optProtein!}
            unit="g/day"
            highlight
          />
          <CalcResult
            label="Minimum (anti-sarcopenia)"
            value={minProtein!}
            unit="g/day"
          />
          <CalcResult
            label="Athletic target (heavy training)"
            value={athProtein!}
            unit="g/day"
          />
          {chickenServings !== null && (
            <p className="pt-3 text-caption text-muted-foreground">
              ≈ {chickenServings} servings of 6oz cooked chicken breast equivalent
              spread across the day.
            </p>
          )}
        </div>
      )}
    </CalculatorCard>
  );
}
