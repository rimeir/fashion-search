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
  isFashion: boolean;
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
    isFashion: {
      type: "boolean",
      description:
        "허용된 패션 대분류(상의/하의/아우터/신발/가방)에 속하는 품목이면 true, 아니면 false. 시스템 프롬프트의 예시 목록에 없어도 대분류에 속하면 true로 판단한다.",
    },
  },
  required: ["keywords", "priceMin", "priceMax", "categories", "isFashion"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `너는 패션 이커머스 검색어 분석기다. 사용자의 자연어 요청과 프로필을 분석해서
keywords, priceMin, priceMax, categories, isFashion 필드를 가진 JSON만 반환한다.

패션 카테고리 검증 규칙:
허용 대분류는 상의 / 하의 / 아우터 / 신발 / 가방, 이 5가지뿐이다.
아래 괄호 안 품목은 이해를 돕기 위한 예시일 뿐 전체 목록이 아니다.
괄호에 없는 품목이어도 5개 대분류 중 하나에 해당하면 반드시 허용(isFashion: true)한다.

- 상의 (예: 티셔츠, 셔츠, 니트, 후드, 맨투맨, 블라우스 등)
- 하의 (예: 바지, 슬랙스, 청바지, 스커트, 반바지 등)
- 아우터 (예: 자켓, 코트, 패딩, 점퍼, 가디건, 블레이저 등)
- 신발 (예: 운동화, 로퍼, 부츠, 샌들, 슬리퍼, 하이힐, 구두, 워커 등)
- 가방 (예: 백팩, 숄더백, 토트백, 크로스백, 클러치 등)

원피스(여성용 치마 원피스), 모자, 머플러도 허용 품목이다(isFashion: true).
이 셋은 위 5개 대분류 중 어디에도 넣지 말고, categories 필드에 그대로
"원피스", "모자", "머플러"라고 반환한다.

비허용 카테고리(이런 것들은 예시에 없어도 항상 제외): 속옷/언더웨어,
선글라스/안경, 시계/쥬얼리/악세사리,
스마트폰/전자기기, 음식/식품,
화장품/뷰티, 스포츠용품(옷 제외),
양말/스타킹

판단 기준: 요청한 품목이 5개 대분류 중 하나이거나 원피스·모자·머플러면,
목록에 없어도 isFashion: true.
비허용 카테고리에 해당하거나 5개 대분류·원피스·모자·머플러 어디에도
속하지 않으면 isFashion: false.

JSON에 isFashion: boolean 추가.
isFashion이 false면
keywords: [], priceMin: 0, priceMax: 999999,
categories: [], isFashion: false 반환.

keywords 규칙 (반드시 준수):
- + 기호는 구분자이므로 keywords에 절대 포함하지 마라
- 가격 관련 단어(만원, 원, 이하, 이상, 전후, 대)는 keywords에 절대 포함하지 마라
- 계절/상황 단어(여름, 겨울, 봄, 가을)는 keywords에 포함해도 됨
- 색상/소재/분위기 등 수식어는 아이템명과 분리해서 각각 별도의 키워드로 만든다
  (예: '검정색 맨투맨' → ['검정색', '맨투맨'], '린넨 셔츠' → ['린넨', '셔츠'])
- 단, 후드집업처럼 여러 단어가 합쳐져야 하나의 품목명이 되는 경우는
  공백만 제거해 한 단어로 합친다 (예: '후드 집업' → '후드집업')
- 키워드 하나하나는 공백 없이 한 단어로
- 반드시 실제 의류 관련 단어만 포함

예시:
'린넨 셔츠 + 여름 + 3만원대' → keywords: ['린넨', '셔츠', '여름']
'후드 집업 + 오버핏 + 4만원' → keywords: ['후드집업', '오버핏']
'검정색 맨투맨 + 4만원' → keywords: ['검정색', '맨투맨']
'블랙 슬랙스 + 미니멀 + 7만원 이하' → keywords: ['블랙', '슬랙스', '미니멀']

가격 표현 파싱 규칙:
- "5만원 전후"처럼 "N만원 전후"는 priceMin: (N-1)*10000, priceMax: (N+1)*10000 으로 해석한다. (예: 5만원 전후 → priceMin: 40000, priceMax: 60000)
- "3만원대"처럼 "N만원대"는 priceMin: N*10000, priceMax: N*10000+9999 로 해석한다. (예: 3만원대 → priceMin: 30000, priceMax: 39999)
- 수식어 없이 "N만원"만 단독으로 언급되면 priceMin: N*10000*0.9, priceMax: N*10000*1.1 로 해석한다 (±10%). (예: 4만원 → priceMin: 36000, priceMax: 44000, 예: 3만원 → priceMin: 27000, priceMax: 33000)
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
// isFashion 여부는 판단할 수 없으므로 검색을 막지 않도록 true로 둔다.
function fallbackParse(query: string): ParsedFilters {
  return {
    keywords: query.split(/\s+/).filter(Boolean),
    priceMin: 0,
    priceMax: 999999,
    categories: [],
    isFashion: true,
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
    v.categories.every((c) => typeof c === "string") &&
    typeof v.isFashion === "boolean"
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

    const message = await anthropic.messages.parse(
      {
        model: PARSE_MODEL,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(query, profile) }],
        output_config: {
          format: jsonSchemaOutputFormat(OUTPUT_SCHEMA),
        },
      },
      { fetchOptions: { cache: "no-store" } }
    );

    if (!isValidParsedFilters(message.parsed_output)) {
      return Response.json(fallbackParse(query));
    }

    const { keywords, priceMin, priceMax, categories, isFashion } = message.parsed_output;
    console.log("[PARSE RESULT]", {
      keywords,
      priceMin,
      priceMax,
      categories,
      isFashion,
      receivedProfile: profile,
    });

    return Response.json(message.parsed_output);
  } catch (error) {
    console.error("[/api/parse]", error);
    return Response.json(fallbackParse(query));
  }
}
