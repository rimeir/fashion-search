import axios from "axios";

const KAKAO_SHOPPING_ENDPOINT = "https://dapi.kakao.com/v2/search/shopping";

interface SearchRequestBody {
  keywords: string[];
  priceMin: number;
  priceMax: number;
  categories: string[];
}

interface KakaoShoppingDocument {
  title: string;
  link: string;
  image: string;
  price: number;
  mallName: string;
}

interface KakaoShoppingResponse {
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
  documents: KakaoShoppingDocument[];
}

interface ShoppingItem {
  title: string;
  price: number;
  thumbnail: string;
  url: string;
  mallName: string;
}

// 카카오 쇼핑 검색은 제목에 <b> 강조 태그를 포함해 반환하므로 HTML 태그를 제거한다.
function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}

function toShoppingItem(doc: KakaoShoppingDocument): ShoppingItem {
  return {
    title: stripHtml(doc.title),
    price: Number(doc.price) || 0,
    thumbnail: doc.image,
    url: doc.link,
    mallName: doc.mallName,
  };
}

export async function POST(request: Request) {
  try {
    const body: Partial<SearchRequestBody> = await request.json();
    const keywords = body.keywords ?? [];
    const priceMin = body.priceMin ?? 0;
    const priceMax = body.priceMax ?? 999999;

    const query = keywords.join(" ").trim();
    if (!query) {
      return Response.json({ error: "keywords가 필요합니다." }, { status: 400 });
    }

    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) {
      throw new Error("카카오 API 인증 정보가 설정되지 않았습니다 (.env.local 확인).");
    }

    const { data } = await axios.get<KakaoShoppingResponse>(KAKAO_SHOPPING_ENDPOINT, {
      params: { query, size: 20, sort: "accuracy" },
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });

    const items = data.documents.map(toShoppingItem);

    // priceMin이 0이면 가격 정보가 없다는 뜻이므로 가격 필터를 적용하지 않는다.
    const filtered =
      priceMin === 0
        ? items
        : items.filter((item) => item.price >= priceMin && item.price <= priceMax);

    return Response.json({ products: filtered, total: data.meta.total_count });
  } catch (error) {
    console.error("[/api/search]", error);
    return Response.json(
      { error: "상품 검색 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
