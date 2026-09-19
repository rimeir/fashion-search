import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { anthropic, PARSE_MODEL } from "@/lib/anthropic";

interface RequestProfile {
  age: string;
  gender: string;
  styles: string[];
}

interface RequestBody {
  query: string;
  profile: RequestProfile;
}

interface ParsedFilters {
  keywords: string[];
  priceMin: number;
  priceMax: number;
  categories: string[];
}

// output_config.format으로 넘길 JSON 스키마. additionalProperties: false + required 전체 지정으로
// Claude가 이 구조를 벗어난 텍스트를 반환하지 못하도록 강제한다.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    keywords: {
      type: "array",
      items: { type: "string" },
      description: "검색에 사용할 핵심 키워드 (색상, 소재, 분위기, 상황 등).",
    },
    priceMin: {
      type: "integer",
      description: "최소 가격(원).",
    },
    priceMax: {
      type: "integer",
      description: "최대 가격(원).",
    },
    categories: {
      type: "array",
      items: { type: "string" },
      description: "상품 카테고리 목록 (예: 원피스, 니트, 스니커즈).",
    },
  },
  required: ["keywords", "priceMin", "priceMax", "categories"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `너는 패션 이커머스 검색어 분석기다. 사용자의 자연어 요청과 프로필을 분석해서
keywords, priceMin, priceMax, categories 필드를 가진 JSON만 반환한다.

가격 표현 파싱 규칙:
- "5만원 전후"처럼 "N만원 전후"는 priceMin: (N-1)*10000, priceMax: (N+1)*10000 으로 해석한다. (예: 5만원 전후 → priceMin: 40000, priceMax: 60000)
- "3만원대"처럼 "N만원대"는 priceMin: N*10000, priceMax: N*10000+9999 로 해석한다. (예: 3만원대 → priceMin: 30000, priceMax: 39999)
- 가격 언급이 전혀 없으면 priceMin: 0, priceMax: 999999 로 한다.
- 그 외 명시적인 가격/범위 표현("~이하", "~이상", "N원부터 M원")은 문맥에 맞게 합리적으로 변환한다.

사용자 프로필(나이/성별/선호 스타일)은 카테고리와 키워드 해석의 참고 정보로만 사용하고,
사용자가 메시지에서 명시한 조건을 항상 우선한다.`;

function buildUserMessage(query: string, profile: RequestProfile): string {
  const profileLines = [
    profile.age ? `나이: ${profile.age}` : null,
    profile.gender ? `성별: ${profile.gender}` : null,
    profile.styles?.length ? `선호 스타일: ${profile.styles.join(", ")}` : null,
  ].filter(Boolean);

  return profileLines.length
    ? `[사용자 프로필]\n${profileLines.join("\n")}\n\n[검색 요청]\n${query}`
    : query;
}

// Claude 응답 파싱에 실패했을 때의 fallback: query를 공백 기준으로 쪼개 키워드로 사용한다.
function fallbackParse(query: string): ParsedFilters {
  return {
    keywords: query.split(/\s+/).filter(Boolean),
    priceMin: 0,
    priceMax: 999999,
    categories: [],
  };
}

function isValidParsedFilters(value: unknown): value is ParsedFilters {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.keywords) &&
    v.keywords.every((k) => typeof k === "string") &&
    typeof v.priceMin === "number" &&
    typeof v.priceMax === "number" &&
    Array.isArray(v.categories) &&
    v.categories.every((c) => typeof c === "string")
  );
}

export async function POST(request: Request) {
  let query = "";

  try {
    const body: Partial<RequestBody> = await request.json();
    query = body?.query ?? "";
    const profile: RequestProfile = {
      age: body?.profile?.age ?? "",
      gender: body?.profile?.gender ?? "",
      styles: body?.profile?.styles ?? [],
    };

    if (!query.trim()) {
      return Response.json({ error: "query가 필요합니다." }, { status: 400 });
    }

    const message = await anthropic.messages.parse({
      model: PARSE_MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(query, profile) }],
      output_config: {
        format: jsonSchemaOutputFormat(OUTPUT_SCHEMA),
      },
    });

    if (!isValidParsedFilters(message.parsed_output)) {
      return Response.json(fallbackParse(query));
    }

    return Response.json(message.parsed_output);
  } catch (error) {
    console.error("[/api/parse]", error);
    return Response.json(fallbackParse(query));
  }
}
