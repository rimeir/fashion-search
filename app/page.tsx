"use client";

import { useEffect, useRef, useState } from "react";
import ProfileSetup from "@/components/ProfileSetup";
import SearchBar from "@/components/SearchBar";
import ParsedBadges from "@/components/ParsedBadges";
import ProductGrid from "@/components/ProductGrid";
import { EMPTY_PROFILE, type ParsedQuery, type Product, type UserProfile } from "@/lib/types";

const PROFILE_STORAGE_KEY = "fashion-search-profile";

export default function Home() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastParsed, setLastParsed] = useState<ParsedQuery | null>(null);

  // handleSearch 등 콜백이 클로저로 오래된 profile을 참조하지 않도록 항상 최신값을 추적한다.
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // localStorage는 서버에 없는 client-only 저장소라 첫 렌더는 항상 기본값으로 그린 뒤
  // mount 이후 이 effect에서 한 번만 동기화한다(SSR/hydration mismatch 방지).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        setProfile(JSON.parse(saved));
      } else {
        setIsProfileOpen(true);
      }
    } catch {
      setIsProfileOpen(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleProfileChange(next: UserProfile) {
    setProfile(next);
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage 사용 불가 환경에서는 세션 동안만 프로필을 유지한다.
    }
  }

  async function handleSearch(query: string) {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const profile = profileRef.current;
      const parseRes = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          query,
          profile: {
            age: profile.ageGroup ?? "",
            gender: profile.gender ?? "",
            styles: profile.styles,
          },
        }),
      });
      if (!parseRes.ok) {
        const body = await parseRes.json().catch(() => null);
        throw new Error(body?.error ?? "검색어 분석에 실패했습니다.");
      }
      const parsed: ParsedQuery = await parseRes.json();
      setLastParsed(parsed);

      if (parsed.isFashion === false) {
        setProducts([]);
        setError("👗 상의, 하의, 아우터, 신발, 가방만 검색할 수 있어요!");
        return;
      }

      const searchRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          keywords: parsed.keywords,
          categories: parsed.categories,
          priceMin: parsed.priceMin,
          priceMax: parsed.priceMax,
          profile: profileRef.current,
        }),
      });
      if (!searchRes.ok) {
        const body = await searchRes.json().catch(() => null);
        throw new Error(body?.error ?? "상품 검색에 실패했습니다.");
      }
      const { products: results }: { products: Product[] } = await searchRes.json();
      setProducts(results);
    } catch (err) {
      setProducts([]);
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Fitto
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">말하듯이 검색하세요</p>
          </div>
          <button
            type="button"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            aria-expanded={isProfileOpen}
            className="flex items-center gap-1 rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
          >
            프로필 설정
            <span
              className={`transition-transform duration-200 ${isProfileOpen ? "rotate-180" : ""}`}
              aria-hidden
            >
              ▾
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
        <div
          className={`grid transition-[grid-template-rows] duration-300 ${
            isProfileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <ProfileSetup profile={profile} onChange={handleProfileChange} />
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <SearchBar onSearch={handleSearch} loading={loading} />
          {lastParsed && !loading && <ParsedBadges parsed={lastParsed} />}
        </section>

        {hasSearched && (
          <section className="flex flex-1 flex-col">
            <ProductGrid products={products} loading={loading} error={error} />
          </section>
        )}
      </main>
    </div>
  );
}
