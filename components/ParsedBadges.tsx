import type { ParsedQuery } from "@/lib/types";

interface ParsedBadgesProps {
  parsed: ParsedQuery;
}

// 원 단위 가격을 "만원" 단위 문자열로 변환한다 (예: 40000 → "4", 35000 → "3.5").
function toManwon(won: number): string {
  const man = won / 10000;
  return Number.isInteger(man) ? `${man}` : man.toFixed(1);
}

function formatPriceLabel(priceMin: number, priceMax: number): string | null {
  const hasMin = priceMin > 0;
  const hasMax = priceMax < 999999;

  if (!hasMin && !hasMax) return null;
  if (hasMin && hasMax) return `${toManwon(priceMin)}~${toManwon(priceMax)}만원`;
  if (hasMax) return `${toManwon(priceMax)}만원 이하`;
  return `${toManwon(priceMin)}만원 이상`;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}

export default function ParsedBadges({ parsed }: ParsedBadgesProps) {
  const priceLabel = formatPriceLabel(parsed.priceMin, parsed.priceMax);

  if (!parsed.keywords.length && !parsed.categories.length && !priceLabel) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {parsed.categories.map((category) => (
        <Badge key={`category-${category}`}>카테고리: {category}</Badge>
      ))}
      {parsed.keywords.map((keyword) => (
        <Badge key={`keyword-${keyword}`}>키워드: {keyword}</Badge>
      ))}
      {priceLabel && <Badge key="price">가격: {priceLabel}</Badge>}
    </div>
  );
}
