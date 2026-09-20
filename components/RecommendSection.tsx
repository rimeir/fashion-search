import type { Product, RecommendResult } from "@/lib/types";

interface RecommendSectionProps {
  recommendations: RecommendResult | null;
  loading: boolean;
}

const LABELS: { key: keyof RecommendResult; label: string }[] = [
  { key: "bottom", label: "하의" },
  { key: "shoes", label: "신발" },
  { key: "outer", label: "아우터" },
];

function formatPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}

function RecommendCardSkeleton() {
  return (
    <div className="w-40 shrink-0 animate-pulse">
      <div className="aspect-square w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export default function RecommendSection({ recommendations, loading }: RecommendSectionProps) {
  if (loading) {
    return (
      <section>
        <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          이런 코디는 어때요? 👗
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-2">
          <RecommendCardSkeleton />
          <RecommendCardSkeleton />
          <RecommendCardSkeleton />
        </div>
      </section>
    );
  }

  const items = LABELS.map(({ key, label }) => ({
    label,
    product: recommendations?.[key] ?? null,
  })).filter(
    (item): item is { label: string; product: Product } => item.product !== null
  );

  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        이런 코디는 어때요? 👗
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map(({ label, product }) => (
          <a
            key={label}
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-40 shrink-0"
          >
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.thumbnail}
                alt={product.title}
                className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                loading="lazy"
              />
            </div>
            <p className="mt-2 text-xs font-medium text-zinc-400">{label}</p>
            <p className="line-clamp-2 text-sm text-zinc-800 dark:text-zinc-100">
              {product.title}
            </p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {formatPrice(product.price)}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
