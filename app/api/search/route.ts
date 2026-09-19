import type { Product } from "@/lib/types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search";
const MAX_RESULTS = 20;

interface SearchRequestBody {
  keywords: string[];
  priceMin: number;
  priceMax: number;
  categories: string[];
}

interface SerpApiShoppingItem {
  title?: string;
  price?: number;
  thumbnail?: string;
  link?: string;
  stores?: string;
}

interface SerpApiShoppingResponse {
  shopping_results?: SerpApiShoppingItem[];
}

function toProduct(item: SerpApiShoppingItem): Product {
  return {
    title: item.title ?? "",
    price: Number(item.price),
    thumbnail: item.thumbnail ?? "",
    url: item.link ?? "",
    mallName: item.stores ?? "",
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "SERPAPI_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const body: Partial<SearchRequestBody> = await request.json();
    const keywords = body.keywords ?? [];
    const priceMin = body.priceMin ?? 0;
    const priceMax = body.priceMax ?? 999999;

    const query = keywords.join(" ").trim();
    if (!query) {
      return Response.json({ error: "keywords가 필요합니다." }, { status: 400 });
    }

    const url = new URL(SERPAPI_ENDPOINT);
    url.searchParams.set("engine", "naver");
    url.searchParams.set("query", query);
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      // SerpApi 요청/응답 실패는 파싱 실패로 간주하고 빈 결과를 반환한다.
      return Response.json({ products: [], total: 0 });
    }

    const data: SerpApiShoppingResponse = await res.json();
    if (!Array.isArray(data.shopping_results)) {
      return Response.json({ products: [], total: 0 });
    }

    const products = data.shopping_results.map(toProduct);

    // [DEBUG] 가격 필터 디버깅: 첫 번째 아이템 기준으로 price/priceMin/priceMax와 통과 여부를 확인한다.
    if (products[0]) {
      const firstItemPrice = products[0].price;
      const firstItemPassed = firstItemPrice >= priceMin && firstItemPrice <= priceMax;
      console.log("[DEBUG] price filter check:", {
        firstItemPrice,
        priceMin,
        priceMax,
        firstItemPassed,
      });
    }

    // priceMin이 0이면 가격 정보가 없다는 뜻이므로 가격 필터를 적용하지 않는다.
    const filtered =
      priceMin === 0
        ? products
        : products.filter((p) => p.price >= priceMin && p.price <= priceMax);

    const limited = filtered.slice(0, MAX_RESULTS);

    return Response.json({ products: limited, total: limited.length });
  } catch (error) {
    console.error("[/api/search]", error);
    return Response.json({ products: [], total: 0 });
  }
}
