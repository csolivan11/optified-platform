"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import {
  CalculatorCard,
  CalcInput,
  CalcSelect,
  CalcResult,
} from "./calculator-card";

type Goal = "cut" | "maintain" | "lean_gain";

const GOAL_OPTS: Array<{ value: Goal; label: string }> = [
  { value: "cut", label: "Fat loss (−500 kcal)" },
  { value: "maintain", label: "Maintenance" },
  { value: "lean_gain", label: "Lean gain (+300 kcal)" },
];

/**
 * Protein-first split:
 *   protein = 1.0 g/lb of bodyweight (high end of evidence range,
 *             optimized for body recomposition)
 *   fat     = 25-30% of total kcal
 *   carbs   = remainder
 *
 * 1g protein = 4 kcal · 1g carb = 4 kcal · 1g fat = 9 kcal
 */
export function MacroCalculator() {
  const [tdee, setTdee] = useState("2500");
  const [weightLbs, setWeightLbs] = useState("180");
  const [goal, setGoal] = useState<Goal>("maintain");

  const tdeeN = Number(tdee);
  const wN = Number(weightLbs);
  const valid = tdeeN > 0 && wN > 0;

  const calorieTarget =
    goal === "cut" ? tdeeN - 500 : goal === "lean_gain" ? tdeeN + 300 : tdeeN;

  const proteinG = Math.round(wN * 1.0);
  const proteinCal = proteinG * 4;

  const fatPct = goal === "cut" ? 0.3 : 0.27;
  const fatCal = Math.round(calorieTarget * fatPct);
  const fatG = Math.round(fatCal / 9);

  const carbCal = calorieTarget - proteinCal - fatCal;
  const carbG = Math.round(carbCal / 4);

  return (
    <CalculatorCard
      title="Macro Calculator"
      description="Protein-first macros tuned to your TDEE and goal."
      icon={Target}
    >
      <div className="grid grid-cols-2 gap-3 mt-4">
        <CalcInput label="TDEE" value={tdee} onChange={setTdee} unit="kcal" />
        <CalcInput
          label="Bodyweight"
          value={weightLbs}
          onChange={setWeightLbs}
          unit="lbs"
        />
      </div>
      <div className="mt-3">
        <CalcSelect
          label="Goal"
          value={goal}
          onChange={setGoal}
          options={GOAL_OPTS}
        />
      </div>

      {valid && (
        <div className="mt-5 space-y-1">
          <CalcResult
            label="Calories"
            value={calorieTarget.toLocaleString()}
            unit="kcal/day"
            highlight
          />
          <CalcResult label="Protein" value={proteinG} unit="g" />
          <CalcResult label="Fat" value={fatG} unit="g" />
          <CalcResult label="Carbs" value={Math.max(0, carbG)} unit="g" />
        </div>
      )}

      <p className="mt-3 text-caption text-muted-foreground">
        Protein target uses 1g per pound of bodyweight — the upper end of
        evidence-based ranges, calibrated for body recomposition.
      </p>
    </CalculatorCard>
  );
}
