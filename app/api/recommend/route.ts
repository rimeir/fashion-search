import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { anthropic, RECOMMEND_MODEL } from "@/lib/anthropic";
import type { Product, RecommendResult } from "@/lib/types";

interface RecommendRequestBody {
  mainItem: string;
  category: string;
  gender: string;
}

interface RecommendFlags {
  bottom: boolean;
  shoes: boolean;
  outer: boolean;
  top: boolean;
}

const SYSTEM_PROMPT = `너는 패션 코디 전문가야.
JSON만 반환하고 다른 텍스트는 절대 포함하지 마.`;

// mainItem의 category와 같은 종류를 다시 추천하지 않도록, category에 따라 필요한 코디 구성을 결정한다.
function getRecommendItems(category: string): RecommendFlags {
  const 상의카테고리 = ["상의", "티셔츠", "셔츠", "니트", "후드", "맨투맨", "후드집업"];
  const 하의카테고리 = ["하의", "바지", "슬랙스", "청바지", "스커트", "반바지", "진", "데님팬츠"];
  const 아우터카테고리 = ["아우터", "자켓", "코트", "패딩", "점퍼", "가디건"];
  const 신발카테고리 = ["신발", "운동화", "로퍼", "부츠", "샌들", "스니커즈"];

  if (상의카테고리.some((c) => category.includes(c))) {
    return { bottom: true, shoes: true, outer: true, top: false };
  }
  if (하의카테고리.some((c) => category.includes(c))) {
    return { bottom: false, shoes: true, outer: true, top: true };
  }
  if (아우터카테고리.some((c) => category.includes(c))) {
    return { bottom: true, shoes: true, outer: false, top: true };
  }
  if (신발카테고리.some((c) => category.includes(c))) {
    return { bottom: true, shoes: false, outer: false, top: true };
  }
  // 기본값: 상의 검색으로 간주
  return { bottom: true, shoes: true, outer: true, top: false };
}

const FIELD_LINES: Record<keyof RecommendFlags, string> = {
  bottom: "bottom: '하의 검색 키워드 (예: 와이드 청바지)'",
  shoes: "shoes: '신발 검색 키워드 (예: 흰 스니커즈)'",
  outer: "outer: '아우터 검색 키워드 (예: 오버핏 캐주얼 자켓)'",
  top: "top: '상의 검색 키워드 (예: 크롭 니트)'",
};

const FIELD_DESCRIPTIONS: Record<keyof RecommendFlags, string> = {
  bottom: "하의 검색 키워드 (예: 와이드 청바지)",
  shoes: "신발 검색 키워드 (예: 흰 스니커즈)",
  outer: "아우터 검색 키워드 (예: 오버핏 캐주얼 자켓)",
  top: "상의 검색 키워드 (예: 크롭 니트)",
};

// flags에서 true인 항목만 뽑아 필요한 키 목록을 만든다. bottom > shoes > outer > top 순서 고정.
function getNeededKeys(flags: RecommendFlags): Array<keyof RecommendFlags> {
  return (["bottom", "shoes", "outer", "top"] as const).filter((key) => flags[key]);
}

function buildSchema(keys: Array<keyof RecommendFlags>) {
  const properties: Record<string, { type: "string"; description: string }> = {};
  for (const key of keys) {
    properties[key] = { type: "string", description: FIELD_DESCRIPTIONS[key] };
  }
  return {
    type: "object" as const,
    properties,
    required: keys,
    additionalProperties: false,
  };
}

function buildUserPrompt(gender: string, mainItem: string, keys: Array<keyof RecommendFlags>): string {
  const lines = keys.map((key) => `  ${FIELD_LINES[key]}`).join(",\n");

  return `${gender}이 ${mainItem}을 입을 때
어울리는 코디를 추천해줘.
아래 JSON 형식으로만 반환해:
{
${lines}
}
각 키워드는 네이버 쇼핑 검색에 바로 쓸 수 있는
2~4단어로 만들어줘.`;
}

function isValidKeywords(
  value: unknown,
  keys: Array<keyof RecommendFlags>
): value is Record<string, string> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return keys.every((key) => typeof v[key] === "string");
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
  const empty: RecommendResult = { bottom: null, shoes: null, outer: null, top: null };

  try {
    const body: Partial<RecommendRequestBody> = await request.json();
    const mainItem = body.mainItem ?? "";
    const category = body.category ?? "";
    const gender = body.gender ?? "";

    if (!mainItem) {
      return Response.json({ error: "mainItem이 필요합니다." }, { status: 400 });
    }

    const flags = getRecommendItems(category);
    const keys = getNeededKeys(flags);
    const schema = buildSchema(keys);

    let parsedOutput: unknown = null;
    try {
      const message = await anthropic.messages.parse(
        {
          model: RECOMMEND_MODEL,
          max_tokens: 500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(gender, mainItem, keys) }],
          output_config: { format: jsonSchemaOutputFormat(schema) },
        },
        { fetchOptions: { cache: "no-store" } }
      );
      parsedOutput = message.parsed_output;
    } catch (error) {
      console.error("[/api/recommend] claude call failed:", error);
    }

    if (!isValidKeywords(parsedOutput, keys)) {
      return Response.json(empty);
    }

    const origin = new URL(request.url).origin;
    const products = await Promise.all(
      keys.map((key) => fetchTopProduct(parsedOutput[key], gender, origin))
    );

    const result: RecommendResult = { ...empty };
    keys.forEach((key, i) => {
      result[key] = products[i];
    });

    return Response.json(result);
  } catch (error) {
    console.error("[/api/recommend]", error);
    return Response.json(empty);
  }
}
