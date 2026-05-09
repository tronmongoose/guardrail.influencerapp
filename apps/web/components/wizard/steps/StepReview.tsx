"use client";

import { SkinPicker } from "@/components/skins/SkinPicker";
import type { WizardState } from "../ProgramWizard";

interface StepReviewProps {
  state: WizardState;
  programId: string;
  skinId: string;
  onSkinChange: (skinId: string) => void;
}

export function StepReview({ state, programId, skinId, onSkinChange }: StepReviewProps) {
  const firstThumbnail = state.content.videos[0]?.thumbnailUrl ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Choose Your Theme</h2>
        <p className="text-gray-400 text-sm">
          Pick a look for your program page. You can change it anytime after launch.
        </p>
      </div>

      {/* Skin picker — hero feature */}
      <SkinPicker value={skinId} onChange={onSkinChange} thumbnailUrl={firstThumbnail} programId={programId} programTitle={state.basics.title} />
    </div>
  );
}
