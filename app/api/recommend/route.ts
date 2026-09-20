import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { anthropic, RECOMMEND_MODEL } from "@/lib/anthropic";
import type { Product, RecommendResult } from "@/lib/types";

interface RecommendRequestBody {
  mainItem: string;
  category: string;
  gender: string;
}

const SYSTEM_PROMPT = `너는 패션 코디 전문가야.
JSON만 반환하고 다른 텍스트는 절대 포함하지 마.`;

// mainItem의 category가 하의면 outer 대신 top(상의)을 추천하도록 세 번째 슬롯을 바꾼다.
const OUTER_SCHEMA = {
  type: "object",
  properties: {
    bottom: { type: "string", description: "하의 검색 키워드 (예: 와이드 청바지)" },
    shoes: { type: "string", description: "신발 검색 키워드 (예: 흰 스니커즈)" },
    outer: { type: "string", description: "아우터 검색 키워드 (예: 오버핏 캐주얼 자켓)" },
  },
  required: ["bottom", "shoes", "outer"],
  additionalProperties: false,
} as const;

const TOP_SCHEMA = {
  type: "object",
  properties: {
    bottom: { type: "string", description: "하의 검색 키워드 (예: 와이드 청바지)" },
    shoes: { type: "string", description: "신발 검색 키워드 (예: 흰 스니커즈)" },
    top: { type: "string", description: "상의 검색 키워드 (예: 크롭 니트)" },
  },
  required: ["bottom", "shoes", "top"],
  additionalProperties: false,
} as const;

function buildUserPrompt(gender: string, mainItem: string, thirdKey: "outer" | "top"): string {
  const thirdLine =
    thirdKey === "outer"
      ? "  outer: '아우터 검색 키워드 (예: 오버핏 캐주얼 자켓)'"
      : "  top: '상의 검색 키워드 (예: 크롭 니트)'";

  return `${gender}이 ${mainItem}을 입을 때
어울리는 코디를 추천해줘.
아래 JSON 형식으로만 반환해:
{
  bottom: '하의 검색 키워드 (예: 와이드 청바지)',
  shoes: '신발 검색 키워드 (예: 흰 스니커즈)',
${thirdLine}
}
각 키워드는 네이버 쇼핑 검색에 바로 쓸 수 있는
2~4단어로 만들어줘.`;
}

function isValidKeywords(
  value: unknown,
  thirdKey: "outer" | "top"
): value is Record<"bottom" | "shoes" | "outer" | "top", string> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.bottom === "string" && typeof v.shoes === "string" && typeof v[thirdKey] === "string";
}

// 추천 키워드 하나당 /api/search를 호출해 상위 상품 1개만 뽑아온다. 실패하면 null.
async function fetchTopProduct(keyword: string, gender: string, origin: string): Promise<Product | null> {
  try {
    const res = await fetch(`${origin}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        keywords: [keyword],
        categories: [],
        priceMin: 0,
        priceMax: 999999,
        profile: { gender },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const products: Product[] = Array.isArray(data?.products) ? data.products : [];
    return products[0] ?? null;
  } catch (error) {
    console.error("[/api/recommend] search failed:", keyword, error);
    return null;
  }
}

export async function POST(request: Request) {
  const empty: RecommendResult = { bottom: null, shoes: null, outer: null };

  try {
    const body: Partial<RecommendRequestBody> = await request.json();
    const mainItem = body.mainItem ?? "";
    const category = body.category ?? "";
    const gender = body.gender ?? "";

    if (!mainItem) {
      return Response.json({ error: "mainItem이 필요합니다." }, { status: 400 });
    }

    const thirdKey: "outer" | "top" = category === "하의" ? "top" : "outer";
    const schema = thirdKey === "outer" ? OUTER_SCHEMA : TOP_SCHEMA;

    let parsedOutput: unknown = null;
    try {
      const message = await anthropic.messages.parse(
        {
          model: RECOMMEND_MODEL,
          max_tokens: 500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(gender, mainItem, thirdKey) }],
          output_config: { format: jsonSchemaOutputFormat(schema) },
        },
        { fetchOptions: { cache: "no-store" } }
      );
      parsedOutput = message.parsed_output;
    } catch (error) {
      console.error("[/api/recommend] claude call failed:", error);
    }

    if (!isValidKeywords(parsedOutput, thirdKey)) {
      return Response.json(empty);
    }

    const origin = new URL(request.url).origin;

    const [bottom, shoes, third] = await Promise.all([
      fetchTopProduct(parsedOutput.bottom, gender, origin),
      fetchTopProduct(parsedOutput.shoes, gender, origin),
      fetchTopProduct(parsedOutput[thirdKey], gender, origin),
    ]);

    const result: RecommendResult = { bottom, shoes, outer: third };
    return Response.json(result);
  } catch (error) {
    console.error("[/api/recommend]", error);
    return Response.json(empty);
  }
}
