import type { Product } from "@/lib/types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search";
const MAX_RESULTS = 20;

interface SearchProfile {
  gender?: string;
  styles?: string[];
}

interface SearchRequestBody {
  keywords: string[];
  priceMin: number;
  priceMax: number;
  categories: string[];
  profile?: SearchProfile;
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
    const { keywords = [], priceMin = 0, priceMax = 999999, profile } = body;

    console.log("[SEARCH RECEIVED]", { keywords, priceMin, priceMax });

    // 프로필의 성별을 검색어에 반영해 결과 관련성을 높인다.
    const profileTerms: string[] = [];
    if (profile?.gender === "여성") profileTerms.push("여성");
    if (profile?.gender === "남성") profileTerms.push("남성");

    const query = [...keywords, ...profileTerms].join(" ").trim();
    console.log("[QUERY BUILT]", { query, priceMin, priceMax });

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

    // priceMax가 999999(무제한)보다 작으면 실제 가격 상한이 있다는 뜻이므로 필터를 적용한다.
    const shouldFilter = priceMax < 999999;
    const filtered = products.filter((item) => {
      if (!shouldFilter) return true;
      if (priceMin > 0 && item.price < priceMin) return false;
      if (item.price > priceMax) return false;
      return true;
    });

    console.log("[FILTER RESULT]", {
      totalBefore: products.length,
      totalAfter: filtered.length,
      shouldFilter,
      priceMin,
      priceMax,
    });

    const limited = filtered.slice(0, MAX_RESULTS);

    return Response.json({ products: limited, total: limited.length });
  } catch (error) {
    console.error("[/api/search]", error);
    return Response.json({ products: [], total: 0 });
  }
}
