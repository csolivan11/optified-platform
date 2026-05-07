"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import {
  CalculatorCard,
  CalcInput,
  CalcResult,
} from "./calculator-card";

/**
 * Brzycki:  weight × 36 / (37 − reps)   — accurate for 1-10 reps
 * Epley:    weight × (1 + reps/30)       — accurate for higher rep counts
 *
 * Beta UI shows both plus the average. For most lifters in the 3-8 rep
 * range, they agree within 2-3%.
 */
function brzycki(weight: number, reps: number): number {
  if (reps >= 37) return 0;
  return weight * (36 / (37 - reps));
}

function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export function OneRmCalculator() {
  const [weight, setWeight] = useState("225");
  const [reps, setReps] = useState("5");

  const w = Number(weight);
  const r = Number(reps);
  const valid = w > 0 && r > 0 && r < 30;

  const brz = valid ? Math.round(brzycki(w, r)) : null;
  const ep = valid ? Math.round(epley(w, r)) : null;
  const avg = brz !== null && ep !== null ? Math.round((brz + ep) / 2) : null;

  return (
    <CalculatorCard
      title="1RM Calculator"
      description="Estimate one-rep max from a submaximal set."
      icon={Zap}
    >
      <div className="grid grid-cols-2 gap-3 mt-4">
        <CalcInput
          label="Weight lifted"
          value={weight}
          onChange={setWeight}
          unit="lbs"
        />
        <CalcInput
          label="Reps performed"
          value={reps}
          onChange={setReps}
          unit="reps"
        />
      </div>

      {avg !== null && (
        <div className="mt-5 space-y-1">
          <CalcResult
            label="Estimated 1RM"
            value={avg}
            unit="lbs"
            highlight
          />
          <CalcResult label="Brzycki formula" value={brz!} unit="lbs" />
          <CalcResult label="Epley formula" value={ep!} unit="lbs" />
        </div>
      )}

      {valid && r > 10 && (
        <p className="mt-3 text-caption text-warning">
          Estimates lose accuracy above ~10 reps. For best results, use a set
          in the 3-8 rep range.
        </p>
      )}
    </CalculatorCard>
  );
}
