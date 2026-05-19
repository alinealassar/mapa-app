"use client";

import { useEffect, useState } from "react";
import { Map, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/app/components/BottomNav";

const MOOD_LABELS: Record<string, { label: string; emoji: string; scale: number }> = {
  pessima: { label: "Péssima", emoji: "😣", scale: 1 },
  mal: { label: "Mal", emoji: "😒", scale: 3 },
  neutra: { label: "Neutra", emoji: "😐", scale: 5 },
  bem: { label: "Bem", emoji: "😊", scale: 8 },
  otima: { label: "Ótima", emoji: "🤩", scale: 10 },
};

const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

interface MoodEntry {
  id: string;
  mood_emoji: string;
  mood_scale: number;
  energy_level: number | null;
  tags: string[];
  activities: string[];
  created_at: string;
}

interface WeeklySummaryPatterns {
  title?: string;
  lightest_day?: string;
  heaviest_day?: string;
  top_feelings?: string[];
  pattern?: string;
  closing?: string;
  entries_count?: number;
}

interface WeeklySummary {
  week_start: string;
  summary_text: string;
  patterns: WeeklySummaryPatterns | null;
  created_at: string;
}

interface WeeklySummaryMeta {
  source: "ai" | "cache" | "too_few_entries" | "ai_unsaved";
  count?: number;
  week_start: string;
  week_end: string;
}

export default function MapaPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [weeklySummaryMeta, setWeeklySummaryMeta] = useState<WeeklySummaryMeta | null>(null);
  const [weeklySummaryLoading, setWeeklySummaryLoading] = useState(false);
  // null = ultima semana fechada (default). String YYYY-MM-DD (domingo) = semana
  // especifica do passado. Usuaria navega com as setas no card de Resumo Semanal.
  const [weekStartOverride, setWeekStartOverride] = useState<string | null>(null);
  // Domingo da semana onde esta o registro mais antigo da usuaria. A seta de
  // voltar para de funcionar quando atinge essa semana (nao tem como ter
  // resumo de semana anterior ao primeiro registro).
  const [oldestWeekStart, setOldestWeekStart] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, onboarding_done")
        .eq("id", user.id)
        .single();
      if (!profile?.onboarding_done) {
        window.location.href = "/onboarding";
        return;
      }
      setAuthenticated(true);
    }
    check();
  }, []);

  // Recarrega entries + insights da IA sempre que a semana muda. A semana
  // efetiva vem do meta (que reflete o que o backend resolveu pra essa
  // requisicao). Se ainda nao chegou meta, espera.
  useEffect(() => {
    if (!authenticated) return;
    if (!weeklySummaryMeta?.week_start || !weeklySummaryMeta?.week_end) return;
    loadEntries();
    loadAiInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, weeklySummaryMeta?.week_start, weeklySummaryMeta?.week_end]);

  // Resumo semanal: recarrega ao autenticar OU ao mudar a semana selecionada.
  useEffect(() => {
    if (!authenticated) return;
    loadWeeklySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, weekStartOverride]);

  // Busca a data do primeiro registro da usuaria UMA vez ao autenticar.
  // Usado pra desabilitar a seta de voltar quando chega na primeira semana
  // com dados (nao tem como gerar resumo de semana anterior ao primeiro
  // registro).
  useEffect(() => {
    if (!authenticated) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("mood_entries")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      const first = data?.[0]?.created_at;
      if (!first) return;
      const d = new Date(first);
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day); // volta pro domingo dessa semana
      d.setUTCHours(0, 0, 0, 0);
      setOldestWeekStart(d.toISOString().slice(0, 10));
    })();
  }, [authenticated]);

  async function loadWeeklySummary() {
    setWeeklySummaryLoading(true);
    try {
      const body = weekStartOverride ? { week_start: weekStartOverride } : {};
      const { data, error } = await supabase.functions.invoke(
        "generate-weekly-summary",
        { body }
      );
      if (error) {
        console.error("Erro ao buscar resumo semanal:", error);
        setWeeklySummary(null);
        setWeeklySummaryMeta(null);
      } else if (data?.summary) {
        setWeeklySummary(data.summary as WeeklySummary);
        setWeeklySummaryMeta({
          source: data.source as WeeklySummaryMeta["source"],
          count: data.count,
          week_start: data.week_start,
          week_end: data.week_end,
        });
      } else {
        setWeeklySummary(null);
        setWeeklySummaryMeta(
          data
            ? {
                source: (data.source ||
                  "too_few_entries") as WeeklySummaryMeta["source"],
                count: data.count,
                week_start: data.week_start,
                week_end: data.week_end,
              }
            : null
        );
      }
    } catch (e) {
      console.error("Erro ao chamar generate-weekly-summary:", e);
      setWeeklySummary(null);
      setWeeklySummaryMeta(null);
    } finally {
      setWeeklySummaryLoading(false);
    }
  }

  // Vai pra semana anterior (subtrai 7 dias do weekStart atual)
  function goPrevWeek() {
    const currentStart = weeklySummaryMeta?.week_start || weekStartOverride;
    if (!currentStart) return;
    const d = new Date(`${currentStart}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    setWeekStartOverride(d.toISOString().slice(0, 10));
  }

  // Vai pra semana seguinte. Se a proxima for a "ultima fechada" ou a "em
  // curso", volta pra null (default: comportamento de "ultima fechada").
  function goNextWeek() {
    const currentStart = weeklySummaryMeta?.week_start || weekStartOverride;
    if (!currentStart) return;
    const d = new Date(`${currentStart}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    const nextStr = d.toISOString().slice(0, 10);
    // Calcula qual seria a "ultima fechada" se chamasse sem override
    const today = new Date();
    const todayDay = today.getUTCDay();
    const currentSunday = new Date(today);
    currentSunday.setUTCDate(today.getUTCDate() - todayDay);
    currentSunday.setUTCHours(0, 0, 0, 0);
    const lastClosedStart = new Date(currentSunday);
    lastClosedStart.setUTCDate(currentSunday.getUTCDate() - 7);
    const lastClosedStr = lastClosedStart.toISOString().slice(0, 10);
    // Se chegou na ultima fechada, volta pra null (mesmo resultado, mais limpo)
    if (nextStr >= lastClosedStr) {
      setWeekStartOverride(null);
    } else {
      setWeekStartOverride(nextStr);
    }
  }

  // Pode avancar se a semana atual nao for a ultima fechada
  function canGoNext(): boolean {
    const currentStart = weeklySummaryMeta?.week_start;
    if (!currentStart) return false;
    const today = new Date();
    const todayDay = today.getUTCDay();
    const currentSunday = new Date(today);
    currentSunday.setUTCDate(today.getUTCDate() - todayDay);
    currentSunday.setUTCHours(0, 0, 0, 0);
    const lastClosedStart = new Date(currentSunday);
    lastClosedStart.setUTCDate(currentSunday.getUTCDate() - 7);
    return currentStart < lastClosedStart.toISOString().slice(0, 10);
  }

  // Pode voltar se a semana atual ainda for >= a semana do primeiro registro.
  // (Nao tem como ter resumo de semana sem registro algum.)
  function canGoPrev(): boolean {
    if (!oldestWeekStart) return true; // ainda nao carregou, permite por seguranca
    const currentStart = weeklySummaryMeta?.week_start;
    if (!currentStart) return true;
    return currentStart > oldestWeekStart;
  }

  async function loadEntries() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const ws = weeklySummaryMeta?.week_start;
    const we = weeklySummaryMeta?.week_end;
    if (!ws || !we) { setLoading(false); return; }
    // Tudo na /mapa filtra pela semana atualmente selecionada (dom-sab UTC).
    const startISO = `${ws}T00:00:00.000Z`;
    const endISO = `${we}T23:59:59.999Z`;
    const { data } = await supabase
      .from("mood_entries")
      .select("id, mood_emoji, mood_scale, energy_level, tags, activities, created_at")
      .eq("user_id", user.id)
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: false });
    if (data) setEntries(data as MoodEntry[]);
    setLoading(false);
  }

  async function loadAiInsights() {
    setAiInsightsLoading(true);
    setAiInsights(null);
    try {
      const ws = weeklySummaryMeta?.week_start;
      const we = weeklySummaryMeta?.week_end;
      const { data, error } = await supabase.functions.invoke(
        "generate-mapa-insights",
        { body: ws && we ? { week_start: ws, week_end: we } : {} }
      );
      if (error) {
        console.error("Erro ao buscar insights da IA:", error);
        setAiInsights(null);
      } else if (data?.insights && Array.isArray(data.insights)) {
        setAiInsights(data.insights);
      } else {
        setAiInsights(null);
      }
    } catch (e) {
      console.error("Erro ao chamar generate-mapa-insights:", e);
      setAiInsights(null);
    } finally {
      setAiInsightsLoading(false);
    }
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-mapa-bg">
        <p className="text-mapa-muted italic">um instante</p>
      </main>
    );
  }

  const stats = computeStats(entries);
  const dailyMood = computeDailyMood(entries);
  const topTags = computeTopItems(entries.flatMap((e) => e.tags || []));
  const topActivities = computeTopItems(entries.flatMap((e) => e.activities || []));
  const insights = computeInsights(entries);

  return (
    <>
      <main className="min-h-screen bg-mapa-bg pb-24">
        <div className="px-6 pt-6 text-center">
          <h1 className="font-[family-name:var(--font-quicksand)] text-[24px] font-semibold inline-flex items-center gap-2 justify-center">
            Meu mapa
            <Map size={22} strokeWidth={1.75} className="text-mapa-pink-deep" />
          </h1>
        </div>

        {/* CARD: RESUMO SEMANAL (Sprint 2.3) — semana ANTERIOR (segunda a domingo) */}
        <div className="px-5 pt-5">
          <WeeklySummaryCard
            summary={weeklySummary}
            meta={weeklySummaryMeta}
            loading={weeklySummaryLoading}
            onPrevWeek={goPrevWeek}
            onNextWeek={goNextWeek}
            canGoNext={canGoNext()}
            canGoPrev={canGoPrev()}
          />
        </div>

        {/* Seletor de periodo removido em 17/05/2026: /mapa virou narrativa
            semanal. Filtros 7d/30d/Tudo foram para /historico. */}

        {loading && (
          <p className="text-center text-mapa-muted italic py-10">
            montando seu mapa
          </p>
        )}

        {!loading && entries.length === 0 && (
          <div className="text-center py-16 px-6">
            <span className="text-[40px] block mb-3">🌱</span>
            <p className="text-sm text-mapa-muted">Ainda não tem registros nesse período</p>
            <p className="text-xs text-mapa-muted italic mt-1">
              Quando você registrar alguns momentos, eu vou desenhar seu mapa aqui.
            </p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="px-5 pt-6 space-y-4">
            {/* Card Resumo (3 stats coloridos: momentos / humor medio / energia media) */}
            <div className="bg-mapa-card rounded-[20px] border border-mapa-border p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold text-mapa-pink-deep font-[family-name:var(--font-quicksand)]">
                  Resumo
                </p>
                <InfoButton
                  title="Resumo"
                  content="Três números rápidos do período: quantos momentos você registrou, qual seu humor médio (escala 1-10) e qual sua energia média (escala 1-6). O app pega cada registro seu, soma e calcula a média."
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat value={stats.total} label="momentos" color="pink-deep" />
                <Stat value={stats.avgMood} label="humor médio" color="lavender" suffix="/10" />
                <Stat
                  value={stats.avgEnergy ? stats.avgEnergy.toFixed(1) : "—"}
                  label="energia média"
                  color="mint"
                  suffix={stats.avgEnergy ? "/6" : ""}
                />
              </div>
            </div>

            {/* CARD: HUMOR POR DIA (gráfico de barras) */}
            {dailyMood.length > 0 && (
              <div className="bg-mapa-card rounded-[20px] border border-mapa-border p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[13px] font-semibold text-mapa-pink-deep font-[family-name:var(--font-quicksand)]">
                    Humor ao longo dos dias
                  </p>
                  <InfoButton
                    title="Humor ao longo dos dias"
                    content="Cada barra é a média de humor de um dia. Se você registrou várias vezes no mesmo dia, a Lis calcula a média de todas. Barras cinzas = dias sem registro. A escala vai de 1 (Péssima) a 10 (Ótima), com os emojis na lateral para te orientar."
                  />
                </div>
                <p className="text-[11px] text-mapa-muted italic mb-3">
                  cada barra é a média do dia (1 a 10)
                </p>
                <DailyMoodChart data={dailyMood} />
              </div>
            )}

            {/* CARD: TOP SENTIMENTOS */}
            {topTags.length > 0 && (
              <div className="bg-mapa-card rounded-[20px] border border-mapa-border p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[13px] font-semibold text-mapa-pink-deep font-[family-name:var(--font-quicksand)]">
                    Sentimentos mais presentes
                  </p>
                  <InfoButton
                    title="Sentimentos mais presentes"
                    content="Lista dos 5 sentimentos que você mais marcou no período. O número 'X×' à direita mostra quantas vezes cada um apareceu. A barra é proporcional: o mais frequente fica com a barra cheia, e os outros desenham em proporção. Te ajuda a ver de relance qual sentimento tem ocupado mais espaço na sua semana."
                  />
                </div>
                <p className="text-[11px] text-mapa-muted italic mb-3">
                  o que mais apareceu nos seus registros
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topTags.map(({ name, count }) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium font-[family-name:var(--font-quicksand)]"
                      style={{
                        background: "rgba(196, 122, 155, 0.15)",
                        border: "1px solid rgba(196, 122, 155, 0.3)",
                        color: "#C47A9B",
                      }}
                    >
                      {name}
                      <span
                        className="text-[10px] font-normal"
                        style={{ color: "rgba(196, 122, 155, 0.65)" }}
                      >
                        {count}×
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CARD: TOP ATIVIDADES — paleta lavanda (titulo + chips do mesmo tom) */}
            {topActivities.length > 0 && (
              <div className="bg-mapa-card rounded-[20px] border border-mapa-border p-4">
                <div className="flex items-center justify-between mb-1">
                  <p
                    className="text-[13px] font-semibold font-[family-name:var(--font-quicksand)]"
                    style={{ color: "#6B5B95" }}
                  >
                    O que você mais fez
                  </p>
                  <InfoButton
                    title="O que você mais fez"
                    content="Mesma lógica dos sentimentos, mas pras atividades que você marcou. Ajuda a ver onde seu tempo e energia estão indo no período."
                  />
                </div>
                <p className="text-[11px] text-mapa-muted italic mb-3">
                  atividades mais frequentes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topActivities.map(({ name, count }) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium font-[family-name:var(--font-quicksand)]"
                      style={{
                        background: "rgba(107, 91, 149, 0.15)",
                        border: "1px solid rgba(107, 91, 149, 0.3)",
                        color: "#6B5B95",
                      }}
                    >
                      {name}
                      <span
                        className="text-[10px] font-normal"
                        style={{ color: "rgba(107, 91, 149, 0.65)" }}
                      >
                        {count}×
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CARD: INSIGHTS EM TEXTO (IA com fallback estatístico) */}
            <div className="bg-mapa-mint-light rounded-[20px] border border-mapa-mint p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5BA67D]">
                  🌿 O que percebi
                </p>
                <InfoButton
                  title="O que percebi"
                  content="Aqui a Lis analisa todos os seus registros do período e identifica padrões reais — citando dias, sentimentos e atividades específicas. São observações gentis, sem julgamento. Você decide o que fazer com elas. Se a IA não conseguir, mostro padrões básicos baseados em estatística simples."
                  color="mint"
                />
              </div>
              {aiInsightsLoading && (
                <p className="text-[12px] italic text-[#5BA67D] leading-relaxed font-[family-name:var(--font-quicksand)]">
                  Olhando seus registros para encontrar padrões...
                </p>
              )}
              {!aiInsightsLoading && aiInsights && aiInsights.length > 0 && (
                <div className="space-y-2">
                  {aiInsights.map((text, i) => (
                    <p
                      key={i}
                      className="text-[13px] leading-relaxed text-mapa-text font-[family-name:var(--font-quicksand)]"
                    >
                      {text}
                    </p>
                  ))}
                </div>
              )}
              {!aiInsightsLoading && !aiInsights && insights.length > 0 && (
                <div className="space-y-2">
                  {insights.map((text, i) => (
                    <p
                      key={i}
                      className="text-[13px] leading-relaxed text-mapa-text font-[family-name:var(--font-quicksand)]"
                    >
                      {text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}

// ============ COMPONENTES ============

function formatWeekRangeBR(weekStartIso?: string, weekEndIso?: string): string {
  // weekStartIso vem como "2026-04-27"; weekEndIso opcional ("2026-05-03").
  // Se weekEnd não vier, calcula como weekStart + 6 dias.
  if (!weekStartIso) return "";
  const [sy, sm, sd] = weekStartIso.split("-").map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  let end: Date;
  if (weekEndIso) {
    const [ey, em, ed] = weekEndIso.split("-").map(Number);
    end = new Date(Date.UTC(ey, em - 1, ed));
  } else {
    end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(start.getUTCDate())}/${pad(start.getUTCMonth() + 1)} a ${pad(end.getUTCDate())}/${pad(end.getUTCMonth() + 1)}`;
}

// V1 (Editorial) com cores e sombras da V3 (Dramático).
// Estrutura: aspas decorativas grandes, título dominante 30px Playfair italic,
// respiro generoso. Cores: gradiente saturado pêssego→rosa→lavanda, sombra
// forte que faz o card flutuar, borda branca de 2px.
const SUMMARY_GRADIENT =
  "linear-gradient(155deg, #FFE0CC 0%, #FFD0DA 50%, #E8DDF5 100%)";
const SUMMARY_SHADOW = "0 14px 36px rgba(180, 100, 130, 0.25)";
const SUMMARY_TOP_STRIP =
  "linear-gradient(90deg, #E8A0BF 0%, #B8A9D4 50%, #7BC8A4 100%)";
const SUMMARY_TITLE_COLOR = "#8E3A6B";

function WeeklySummaryCard({
  summary,
  meta,
  loading,
  onPrevWeek,
  onNextWeek,
  canGoNext,
  canGoPrev,
}: {
  summary: WeeklySummary | null;
  meta: WeeklySummaryMeta | null;
  loading: boolean;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  canGoNext?: boolean;
  canGoPrev?: boolean;
}) {
  // Navegacao por semanas — renderizada em todos os estados (loading, too_few,
  // completo). Setas ficam desabilitadas se nao tem handler ou se ja' esta na
  // ultima semana fechada (canGoNext=false).
  const navRange = meta?.week_start && meta?.week_end
    ? formatWeekRangeBR(meta.week_start, meta.week_end)
    : "";
  const showNav = !!(onPrevWeek || onNextWeek);
  const nav = showNav ? (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/40">
      <button
        type="button"
        onClick={onPrevWeek}
        disabled={!onPrevWeek || canGoPrev === false}
        aria-label="Semana anterior"
        className="w-8 h-8 rounded-full bg-white/60 hover:bg-white/90 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-none transition-colors"
        style={{ color: SUMMARY_TITLE_COLOR }}
      >
        <ChevronLeft size={16} strokeWidth={2} />
      </button>
      <span
        className="text-[11px] font-semibold tracking-wider uppercase font-[family-name:var(--font-quicksand)]"
        style={{ color: SUMMARY_TITLE_COLOR }}
      >
        {navRange ? `Semana de ${navRange}` : "Semana"}
      </span>
      <button
        type="button"
        onClick={onNextWeek}
        disabled={!onNextWeek || canGoNext === false}
        aria-label="Semana seguinte"
        className="w-8 h-8 rounded-full bg-white/60 hover:bg-white/90 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-none transition-colors"
        style={{ color: SUMMARY_TITLE_COLOR }}
      >
        <ChevronRight size={16} strokeWidth={2} />
      </button>
    </div>
  ) : null;

  // Estado: carregando
  if (loading) {
    return (
      <div
        className="rounded-[26px] relative overflow-hidden"
        style={{
          background: SUMMARY_GRADIENT,
          border: "2px solid white",
          boxShadow: SUMMARY_SHADOW,
        }}
      >
        <div
          className="h-[8px] w-full"
          style={{ background: SUMMARY_TOP_STRIP }}
        />
        {nav}
        <p className="text-[12px] text-mapa-muted italic font-[family-name:var(--font-playfair)] text-center py-8 px-5">
          Tecendo seu resumo da semana...
        </p>
      </div>
    );
  }

  // Estado: poucos registros na semana passada → placeholder gentil
  if (!summary && meta?.source === "too_few_entries") {
    return (
      <div
        className="rounded-[26px] relative overflow-hidden"
        style={{
          background: SUMMARY_GRADIENT,
          border: "2px solid white",
          boxShadow: SUMMARY_SHADOW,
        }}
      >
        <div
          className="h-[8px] w-full"
          style={{ background: SUMMARY_TOP_STRIP }}
        />
        {nav}
        <div className="px-5 py-5">
          <p className="text-[13.5px] text-mapa-text leading-[1.6] font-[family-name:var(--font-quicksand)]">
            Essa semana teve {meta.count ?? 0}{" "}
            {meta.count === 1 ? "registro" : "registros"}. A partir de 3
            momentos numa semana, eu desenho seu resumo aqui — com os dias
            mais leves, os mais pesados e os padrões que percebi.
          </p>
          <p className="text-[12px] italic mt-3 font-[family-name:var(--font-playfair)]"
             style={{ color: "#8B5C77" }}>
            continue registrando, no seu tempo
          </p>
        </div>
      </div>
    );
  }

  // Estado: erro silencioso ou sem dados → não renderiza nada
  if (!summary) return null;

  const p = summary.patterns || {};
  // Tag "Semana de X" agora ficou no header de navegacao (nav), entao nao
  // duplica aqui no body.

  return (
    <div
      className="rounded-[26px] relative overflow-hidden"
      style={{
        background: SUMMARY_GRADIENT,
        border: "2px solid white",
        boxShadow: SUMMARY_SHADOW,
      }}
    >
      {/* Linha colorida grossa no topo */}
      <div
        className="h-[8px] w-full"
        style={{ background: SUMMARY_TOP_STRIP }}
      />
      {nav}

      <div className="px-5 pt-5 pb-5">
        {/* Aspas decorativas grandes */}
        <div
          className="font-[family-name:var(--font-playfair)] italic select-none"
          style={{
            fontSize: "56px",
            lineHeight: "0.6",
            color: SUMMARY_TITLE_COLOR,
            opacity: 0.4,
            marginTop: "14px",
            marginBottom: "-4px",
          }}
          aria-hidden
        >
          &ldquo;
        </div>

        {/* Título dominante em Playfair italic */}
        {p.title && (
          <h3
            className="font-[family-name:var(--font-playfair)] italic mb-[18px]"
            style={{
              fontSize: "30px",
              fontWeight: 600,
              color: SUMMARY_TITLE_COLOR,
              lineHeight: "1.15",
              letterSpacing: "-0.01em",
              textShadow: "0 1px 0 rgba(255, 255, 255, 0.5)",
            }}
          >
            {p.title}
          </h3>
        )}

        {/* Resumo em texto corrido */}
        {summary.summary_text && (
          <p className="text-[14px] leading-[1.65] text-mapa-text font-[family-name:var(--font-quicksand)] mb-[18px]">
            {summary.summary_text}
          </p>
        )}

        {/* Linhas de dia mais leve / mais pesado em pílulas brancas com sombra */}
        {p.lightest_day && (
          <div
            className="flex items-start gap-2.5 px-3.5 py-3 rounded-[14px] mb-2"
            style={{
              background: "white",
              boxShadow: "0 3px 10px rgba(180, 100, 130, 0.1)",
            }}
          >
            <span className="text-[20px] leading-none shrink-0 mt-[1px]">🌞</span>
            <span className="text-[13px] leading-[1.5] text-mapa-text font-[family-name:var(--font-quicksand)]">
              {p.lightest_day}
            </span>
          </div>
        )}
        {p.heaviest_day && (
          <div
            className="flex items-start gap-2.5 px-3.5 py-3 rounded-[14px] mb-4"
            style={{
              background: "white",
              boxShadow: "0 3px 10px rgba(180, 100, 130, 0.1)",
            }}
          >
            <span className="text-[20px] leading-none shrink-0 mt-[1px]">🌧️</span>
            <span className="text-[13px] leading-[1.5] text-mapa-text font-[family-name:var(--font-quicksand)]">
              {p.heaviest_day}
            </span>
          </div>
        )}

        {/* Chips de top sentimentos com sombra suave */}
        {p.top_feelings && p.top_feelings.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mb-4">
            {p.top_feelings.map((f) => (
              <span
                key={f}
                className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold font-[family-name:var(--font-quicksand)]"
                style={{
                  background:
                    "linear-gradient(135deg, #FFFFFF 0%, #FFEEF5 100%)",
                  color: SUMMARY_TITLE_COLOR,
                  boxShadow: "0 2px 6px rgba(196, 122, 155, 0.15)",
                }}
              >
                {f}
              </span>
            ))}
          </div>
        )}

        {/* Padrão observado em box branco com border-left lavanda */}
        {p.pattern && (
          <div
            className="px-3.5 py-3 rounded-[12px] mb-4"
            style={{
              background: "white",
              borderLeft: "4px solid var(--color-mapa-lavender)",
              boxShadow: "0 3px 10px rgba(184, 169, 212, 0.18)",
            }}
          >
            <p className="text-[13px] leading-[1.55] text-mapa-text font-[family-name:var(--font-quicksand)]">
              {p.pattern}
            </p>
          </div>
        )}

        {/* Fechamento poético centralizado em "ilha" branca */}
        {p.closing && (
          <p
            className="text-center font-[family-name:var(--font-playfair)] italic"
            style={{
              fontSize: "15px",
              fontWeight: 500,
              color: SUMMARY_TITLE_COLOR,
              lineHeight: "1.5",
              padding: "14px 6px",
              background: "rgba(255, 255, 255, 0.55)",
              borderRadius: "14px",
              textShadow: "0 1px 0 rgba(255, 255, 255, 0.4)",
            }}
          >
            {p.closing}
          </p>
        )}
      </div>
    </div>
  );
}

function InfoButton({
  title,
  content,
  color = "pink",
}: {
  title: string;
  content: string;
  color?: "pink" | "mint";
}) {
  const [open, setOpen] = useState(false);
  const iconColor =
    color === "mint"
      ? "text-[#5BA67D]/60 hover:text-[#5BA67D]"
      : "text-mapa-muted/60 hover:text-mapa-pink-deep";
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`shrink-0 ${iconColor} text-[15px] cursor-pointer leading-none rounded-full w-5 h-5 flex items-center justify-center transition`}
        aria-label="Mais informações"
        title="Como ler"
      >
        ⓘ
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-mapa-card rounded-[22px] border border-mapa-border p-5 max-w-sm w-full shadow-2xl"
          >
            <p className="font-semibold text-mapa-pink-deep text-[15px] mb-2 font-[family-name:var(--font-quicksand)]">
              {title}
            </p>
            <p className="text-[13px] text-mapa-text leading-relaxed font-[family-name:var(--font-quicksand)]">
              {content}
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-mapa-pink-light text-mapa-pink-deep font-semibold text-sm cursor-pointer hover:bg-mapa-pink-light/80 transition font-[family-name:var(--font-quicksand)]"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({
  value,
  label,
  color,
  suffix = "",
}: {
  value: number | string;
  label: string;
  color: "pink-deep" | "lavender" | "mint";
  suffix?: string;
}) {
  const colorClass =
    color === "pink-deep"
      ? "text-mapa-pink-deep"
      : color === "lavender"
        ? "text-mapa-lavender"
        : "text-mapa-mint";
  return (
    <div className="text-center">
      <p className={`text-[22px] font-semibold ${colorClass}`}>
        {value}
        <span className="text-[12px] font-normal opacity-70">{suffix}</span>
      </p>
      <p className="text-[10px] text-mapa-muted uppercase tracking-wide mt-0.5">
        {label}
      </p>
    </div>
  );
}

const MOOD_LEGEND = [
  { emoji: "🤩", label: "Ótima" },
  { emoji: "😊", label: "Bem" },
  { emoji: "😐", label: "Neutra" },
  { emoji: "😒", label: "Mal" },
  { emoji: "😣", label: "Péssima" },
];

function DailyMoodChart({ data }: { data: { date: Date; avg: number; count: number }[] }) {
  const max = 10;
  return (
    <div className="flex gap-2 h-44">
      {/* Legenda lateral esquerda — alinhada com a área das barras */}
      <div className="flex flex-col justify-between pb-7 shrink-0">
        {MOOD_LEGEND.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-1 leading-none"
          >
            <span className="text-[13px] leading-none">{item.emoji}</span>
            <span className="text-[10px] text-mapa-muted font-[family-name:var(--font-quicksand)]">
              {item.label}
            </span>
          </div>
        ))}
      </div>
      {/* Barras */}
      <div className="flex-1 flex gap-1.5">
        {data.map((d, i) => {
          const height = d.count > 0 ? (d.avg / max) * 100 : 0;
          const dayLabel = WEEKDAY_LABELS[d.date.getDay()];
          const dayNum = d.date.getDate();
          return (
            <div key={i} className="flex-1 flex flex-col">
              <div className="flex-1 flex items-end">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${Math.max(height, 6)}%`,
                    background:
                      d.count > 0
                        ? "linear-gradient(to top, #E8A0BF, #B8A9D4)"
                        : "#F0E4DC",
                  }}
                  title={
                    d.count > 0
                      ? `${d.avg.toFixed(1)}/10 (${d.count} reg.)`
                      : "sem registro"
                  }
                />
              </div>
              <p className="text-center text-[9px] text-mapa-muted leading-none mt-1.5">
                {dayLabel}
              </p>
              <p className="text-center text-[10px] text-mapa-text font-medium leading-none mt-0.5">
                {dayNum}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ COMPUTAÇÕES ============

function computeStats(entries: MoodEntry[]) {
  const total = entries.length;
  if (total === 0) return { total: 0, avgMood: 0, avgEnergy: 0 };
  const sumMood = entries.reduce((s, e) => s + (e.mood_scale || 5), 0);
  const energyEntries = entries.filter((e) => e.energy_level && e.energy_level > 0);
  const sumEnergy = energyEntries.reduce((s, e) => s + (e.energy_level || 0), 0);
  return {
    total,
    avgMood: Math.round((sumMood / total) * 10) / 10,
    avgEnergy: energyEntries.length > 0 ? sumEnergy / energyEntries.length : 0,
  };
}

function computeDailyMood(entries: MoodEntry[]): { date: Date; avg: number; count: number }[] {
  // Últimos 7 dias (incluindo hoje)
  const days: { date: Date; avg: number; count: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ date: d, avg: 0, count: 0 });
  }
  entries.forEach((e) => {
    const entryDate = new Date(e.created_at);
    entryDate.setHours(0, 0, 0, 0);
    const day = days.find((x) => x.date.getTime() === entryDate.getTime());
    if (day) {
      day.avg = (day.avg * day.count + (e.mood_scale || 5)) / (day.count + 1);
      day.count += 1;
    }
  });
  return days;
}

function computeTopItems(items: string[]): { name: string; count: number }[] {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    counts[item] = (counts[item] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function computeInsights(entries: MoodEntry[]): string[] {
  if (entries.length < 3) {
    return [
      "Conforme você for fazendo mais registros, eu vou identificando padrões aqui para você.",
    ];
  }

  const insights: string[] = [];

  // Insight 1: dia da semana mais leve / mais pesado
  const byWeekday: number[][] = Array.from({ length: 7 }, () => []);
  entries.forEach((e) => {
    const wd = new Date(e.created_at).getDay();
    byWeekday[wd].push(e.mood_scale || 5);
  });
  const weekdayAvgs = byWeekday.map((arr, i) => ({
    weekday: i,
    avg: arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null,
    count: arr.length,
  }));
  const valid = weekdayAvgs.filter((w) => w.avg !== null && w.count >= 2);
  if (valid.length >= 3) {
    const best = valid.reduce((max, w) => (w.avg! > max.avg! ? w : max));
    const worst = valid.reduce((min, w) => (w.avg! < min.avg! ? w : min));
    const dayNames = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];
    if (best.weekday !== worst.weekday && best.avg! - worst.avg! >= 1.5) {
      insights.push(
        `Suas ${dayNames[best.weekday]} têm sido mais leves; já as ${dayNames[worst.weekday]}, mais pesadas.`
      );
    }
  }

  // Insight 2: período do dia preferido para registrar
  const byPeriod = { manhã: 0, tarde: 0, noite: 0 };
  entries.forEach((e) => {
    const hour = new Date(e.created_at).getHours();
    if (hour < 12) byPeriod.manhã += 1;
    else if (hour < 18) byPeriod.tarde += 1;
    else byPeriod.noite += 1;
  });
  const topPeriod = (Object.entries(byPeriod) as [string, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0];
  if (topPeriod[1] >= entries.length * 0.5 && entries.length >= 4) {
    insights.push(
      `Você costuma fazer mais registros ${topPeriod[0] === "manhã" ? "de manhã" : topPeriod[0] === "tarde" ? "à tarde" : "à noite"}.`
    );
  }

  // Insight 3: tag/atividade que aparece muito junto com humor alto
  const positiveEntries = entries.filter((e) => (e.mood_scale || 5) >= 7);
  if (positiveEntries.length >= 3) {
    const positiveTags: Record<string, number> = {};
    positiveEntries.forEach((e) =>
      (e.activities || []).forEach((a) => {
        positiveTags[a] = (positiveTags[a] || 0) + 1;
      })
    );
    const topPositiveActivity = Object.entries(positiveTags).sort((a, b) => b[1] - a[1])[0];
    if (topPositiveActivity && topPositiveActivity[1] >= 2) {
      insights.push(
        `Nos dias em que você marca "${topPositiveActivity[0]}", seu humor tende a ser mais alto.`
      );
    }
  }

  if (insights.length === 0) {
    insights.push(
      "Continue fazendo seus registros — quanto mais momentos, mais clareza eu te trago aqui."
    );
  }

  return insights;
}
