"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import {
  CalculatorCard,
  CalcInput,
  CalcSelect,
  CalcResult,
} from "./calculator-card";

type Sex = "male" | "female";
type Activity = "1.2" | "1.375" | "1.55" | "1.725" | "1.9";

const ACTIVITY_OPTS: Array<{ value: Activity; label: string }> = [
  { value: "1.2", label: "Sedentary (desk job, no exercise)" },
  { value: "1.375", label: "Light (1–3 sessions / week)" },
  { value: "1.55", label: "Moderate (3–5 sessions / week)" },
  { value: "1.725", label: "Heavy (6–7 sessions / week)" },
  { value: "1.9", label: "Athlete (2x daily, physical job)" },
];

/**
 * Mifflin-St Jeor — modern standard for BMR estimation, more accurate
 * than the older Harris-Benedict.
 *
 * Male:   10·kg + 6.25·cm − 5·age + 5
 * Female: 10·kg + 6.25·cm − 5·age − 161
 */
function bmrMifflinStJeor(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function TdeeCalculator() {
  const [sex, setSex] = useState<Sex>("male");
  const [weightLbs, setWeightLbs] = useState("180");
  const [heightFt, setHeightFt] = useState("5");
  const [heightIn, setHeightIn] = useState("10");
  const [age, setAge] = useState("40");
  const [activity, setActivity] = useState<Activity>("1.55");

  const w = Number(weightLbs);
  const ftIn = Number(heightFt) * 12 + Number(heightIn);
  const a = Number(age);

  const weightKg = w * 0.453592;
  const heightCm = ftIn * 2.54;

  const valid = w > 0 && ftIn > 0 && a > 0;
  const bmr = valid ? Math.round(bmrMifflinStJeor(sex, weightKg, heightCm, a)) : null;
  const tdee = bmr !== null ? Math.round(bmr * Number(activity)) : null;
  const cutCal = tdee !== null ? tdee - 500 : null;
  const surplusCal = tdee !== null ? tdee + 300 : null;

  return (
    <CalculatorCard
      title="TDEE Calculator"
      description="Daily energy needs based on BMR and activity level."
      icon={Flame}
    >
      <div className="grid grid-cols-2 gap-3 mt-4">
        <CalcSelect
          label="Sex"
          value={sex}
          onChange={setSex}
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
        <CalcInput label="Age" value={age} onChange={setAge} unit="yrs" />
        <CalcInput
          label="Weight"
          value={weightLbs}
          onChange={setWeightLbs}
          unit="lbs"
        />
        <div className="grid grid-cols-2 gap-2">
          <CalcInput
            label="Height (ft)"
            value={heightFt}
            onChange={setHeightFt}
            unit="ft"
          />
          <CalcInput
            label="(in)"
            value={heightIn}
            onChange={setHeightIn}
            unit="in"
          />
        </div>
      </div>
      <div className="mt-4">
        <CalcSelect
          label="Activity level"
          value={activity}
          onChange={setActivity}
          options={ACTIVITY_OPTS}
        />
      </div>

      {tdee !== null && (
        <div className="mt-5 space-y-1">
          <CalcResult label="BMR (resting)" value={bmr!.toLocaleString()} unit="kcal/day" />
          <CalcResult
            label="Maintenance (TDEE)"
            value={tdee.toLocaleString()}
            unit="kcal/day"
            highlight
          />
          <CalcResult
            label="Fat-loss target (−500)"
            value={cutCal!.toLocaleString()}
            unit="kcal/day"
          />
          <CalcResult
            label="Lean-gain target (+300)"
            value={surplusCal!.toLocaleString()}
            unit="kcal/day"
          />
        </div>
      )}
    </CalculatorCard>
  );
}
