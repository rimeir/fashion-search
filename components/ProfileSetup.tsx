"use client";

import { AGE_GROUPS, GENDERS, STYLES, type UserProfile } from "@/lib/types";

interface ProfileSetupProps {
  profile: UserProfile;
  onChange: (profile: UserProfile) => void;
}

export default function ProfileSetup({ profile, onChange }: ProfileSetupProps) {
  function toggleStyle(style: string) {
    onChange({
      ...profile,
      styles: profile.styles.includes(style)
        ? profile.styles.filter((s) => s !== style)
        : [...profile.styles, style],
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">나이대</p>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map((ageGroup) => (
              <button
                key={ageGroup}
                type="button"
                onClick={() => onChange({ ...profile, ageGroup })}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  profile.ageGroup === ageGroup
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                {ageGroup}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">성별</p>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((gender) => (
              <button
                key={gender}
                type="button"
                onClick={() => onChange({ ...profile, gender })}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  profile.gender === gender
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                {gender}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            선호 스타일 (복수 선택)
          </p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => toggleStyle(style)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  profile.styles.includes(style)
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
