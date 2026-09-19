// 공용 타입 정의

export type AgeGroup = "10대" | "20대" | "30대" | "40대+";
export type Gender = "남성" | "여성";
export const AGE_GROUPS: AgeGroup[] = ["10대", "20대", "30대", "40대+"];
export const GENDERS: Gender[] = ["남성", "여성"];
export const STYLES = ["캐주얼", "스트릿", "미니멀", "빈티지", "포멀", "스포티"] as const;

export interface UserProfile {
  ageGroup: AgeGroup | null;
  gender: Gender | null;
  styles: string[]; // 선호 스타일 (복수 선택)
}

export const EMPTY_PROFILE: UserProfile = {
  ageGroup: null,
  gender: null,
  styles: [],
};

export interface ParsedQuery {
  keywords: string[]; // 색상/소재/무드/상황 등 검색 키워드
  priceMin: number; // 최소 가격(원). 언급 없으면 0
  priceMax: number; // 최대 가격(원). 언급 없으면 999999
  categories: string[]; // 예: 원피스, 니트, 스니커즈
}

export interface Product {
  title: string;
  price: number;
  thumbnail: string;
  url: string;
  mallName: string;
}

export interface SearchApiResponse {
  products: Product[];
  total: number;
}

// /api/parse는 ParsedQuery를 감싸지 않고 그대로 반환한다.
export type ParseApiResponse = ParsedQuery;
