import type { Product } from "@/lib/types";

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  error: string | null;
}

function formatPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}

function ProductCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export default function ProductGrid({ products, loading, error }: ProductGridProps) {
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-zinc-400">
        검색 결과가 없습니다. 다른 검색어로 시도해보세요.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, index) => (
        <a
          key={index}
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col"
        >
          <div className="aspect-square w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
            {/* 카카오 쇼핑 응답 이미지 도메인이 다양해 next/image 대신 일반 img를 사용 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.thumbnail}
              alt={product.title}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-zinc-800 dark:text-zinc-100">
            {product.title}
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {formatPrice(product.price)}
          </p>
          <p className="text-xs text-zinc-400">{product.mallName}</p>
        </a>
      ))}
    </div>
  );
}
