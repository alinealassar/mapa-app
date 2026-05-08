"use client";

import { useState, useEffect, useRef } from "react";
import { BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const MOOD_MAP: Record<
  string,
  { emoji: string; label: string; color: string }
> = {
  pessima: { emoji: "😣", label: "Péssima", color: "text-mapa-coral" },
  mal: { emoji: "😒", label: "Mal", color: "text-[#D4A574]" },
  neutra: { emoji: "😐", label: "Neutra", color: "text-mapa-muted" },
  bem: { emoji: "😊", label: "Bem", color: "text-mapa-mint" },
  otima: { emoji: "🤩", label: "Ótima", color: "text-mapa-pink" },
};

// Sprint 3.1+: como exibir cada qualidade de sono no histórico
const SLEEP_QUALITY_DISPLAY: Record<
  string,
  { emoji: string; label: string }
> = {
  good: { emoji: "😴", label: "acordou bem" },
  ok: { emoji: "🥱", label: "mais ou menos" },
  bad: { emoji: "😵‍💫", label: "acordou mal" },
};

interface MoodEntry {
  id: string;
  mood_emoji: string;
  mood_scale: number;
  energy_level: number;
  tags: string[];
  activities: string[];
  note: string | null;
  audio_url: string | null;
  ai_feedback: string | null;
  created_at: string;
  // Sprint 3.1: campos de sono (opcionais)
  sleep_quality: "good" | "ok" | "bad" | null;
  sleep_hours: number | null;
  // Sprint 3.2: tempo de tela (opcional)
  screen_time_hours: number | null;
}

// Helpers de formatação do sono
function formatSleepCompact(
  quality: "good" | "ok" | "bad" | null,
  hours: number | null
): string | null {
  if (!quality && hours === null) return null;
  const parts: string[] = [];
  if (quality && SLEEP_QUALITY_DISPLAY[quality]) {
    parts.push(SLEEP_QUALITY_DISPLAY[quality].emoji);
  } else {
    parts.push("🌙");
  }
  if (hours !== null) parts.push(`${hours}h`);
  return parts.join(" ");
}

function formatSleepFull(
  quality: "good" | "ok" | "bad" | null,
  hours: number | null
): string | null {
  if (!quality && hours === null) return null;
  const parts: string[] = [];
  if (quality && SLEEP_QUALITY_DISPLAY[quality]) {
    parts.push(
      `${SLEEP_QUALITY_DISPLAY[quality].emoji} ${SLEEP_QUALITY_DISPLAY[quality].label}`
    );
  }
  if (hours !== null) {
    parts.push(`${hours}h dormidas`);
  }
  return parts.join(" · ");
}

// Sprint 3.2: helper de tempo de tela (formato compacto e completo)
function formatScreenTimeCompact(hours: number | null): string | null {
  if (hours === null) return null;
  return `📱 ${hours}h`;
}

function formatScreenTimeFull(hours: number | null): string | null {
  if (hours === null) return null;
  return `📱 ${hours}h no celular`;
}

export default function MoodHistory() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // loadData declarada ANTES do useEffect pra agradar a regra react-hooks/immutability
  async function loadData() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    let query = supabase
      .from("mood_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (filter === "semana") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      query = query.gte("created_at", d.toISOString());
    } else if (filter === "mes") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      query = query.gte("created_at", d.toISOString());
    }

    const { data } = await query;
    if (data) setEntries(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function groupByDay(entries: MoodEntry[]) {
    const groups: Record<string, MoodEntry[]> = {};
    entries.forEach((e) => {
      const key = new Date(e.created_at).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return groups;
  }

  function toggleAudio(id: string, url: string) {
    if (playingAudioId === id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    audioRef.current = new Audio(url);
    audioRef.current.onended = () => setPlayingAudioId(null);
    audioRef.current.play();
    setPlayingAudioId(id);
  }

  function getStats() {
    if (!entries.length) return null;
    const avgScale =
      Math.round(
        (entries.reduce((s, e) => s + (e.mood_scale || 5), 0) /
          entries.length) *
          10
      ) / 10;
    const avgEnergy =
      Math.round(
        (entries.reduce((s, e) => s + (e.energy_level || 0), 0) /
          entries.length) *
          10
      ) / 10;
    const mc: Record<string, number> = {};
    entries.forEach((e) => {
      mc[e.mood_emoji] = (mc[e.mood_emoji] || 0) + 1;
    });
    const topMood = Object.entries(mc).sort((a, b) => b[1] - a[1])[0];
    const tc: Record<string, number> = {};
    entries.forEach((e) =>
      (e.tags || []).forEach((t) => {
        tc[t] = (tc[t] || 0) + 1;
      })
    );
    const topTags = Object.entries(tc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return {
      total: entries.length,
      avgScale,
      avgEnergy,
      topMood: topMood ? MOOD_MAP[topMood[0]] : null,
      topTags,
    };
  }

  const grouped = groupByDay(entries);
  const stats = getStats();
  const filters = [
    { key: "all", label: "Tudo" },
    { key: "semana", label: "7 dias" },
    { key: "mes", label: "30 dias" },
  ];

  return (
    <div>
      <div className="px-6 pt-6 text-center">
        <h1 className="font-[family-name:var(--font-quicksand)] text-[22px] font-medium inline-flex items-center gap-2 justify-center">
          Meu histórico
          <BookOpen size={22} strokeWidth={1.75} className="text-mapa-pink-deep" />
        </h1>
      </div>

      {/* FILTROS */}
      <div className="flex gap-2 px-5 pb-4 pt-3 justify-center">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`py-[7px] px-[18px] rounded-[20px] border-[1.5px] text-xs font-medium cursor-pointer font-[family-name:var(--font-quicksand)] ${filter === f.key ? "bg-mapa-pink text-white border-mapa-pink" : "bg-mapa-card text-mapa-muted border-mapa-border"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* STATS */}
      {stats && (
        <div className="mx-5 mb-5 bg-mapa-card rounded-[20px] border border-mapa-border/50 p-4 pb-3">
          <div className="grid grid-cols-4 gap-2 mb-2.5">
            <div className="text-center">
              <p className="text-xl font-semibold text-mapa-pink-deep">
                {stats.total}
              </p>
              <p className="text-[9px] text-mapa-muted uppercase tracking-wide mt-0.5">
                registros
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-mapa-lavender">
                {stats.avgScale}
              </p>
              <p className="text-[9px] text-mapa-muted uppercase tracking-wide mt-0.5">
                humor médio
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-mapa-mint">
                {stats.avgEnergy}
              </p>
              <p className="text-[9px] text-mapa-muted uppercase tracking-wide mt-0.5">
                energia média
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl">{stats.topMood?.emoji || "—"}</p>
              <p className="text-[9px] text-mapa-muted uppercase tracking-wide mt-0.5">
                frequente
              </p>
            </div>
          </div>
          {stats.topTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-mapa-border/50">
              <span className="text-[10px] text-mapa-muted italic">
                mais comuns:
              </span>
              {stats.topTags.map(([tag, count]) => (
                <span
                  key={tag}
                  className="text-[10px] py-[3px] px-2.5 rounded-xl bg-mapa-pink-light text-mapa-pink-deep font-medium"
                >
                  {tag} ({count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <p className="text-center text-mapa-muted italic py-10">
          carregando seus registros...
        </p>
      )}
      {!loading && !entries.length && (
        <div className="text-center py-16">
          <span className="text-[40px] block mb-3">🌱</span>
          <p className="text-sm text-mapa-muted">Nenhum registro ainda</p>
          <p className="text-xs text-mapa-muted italic">
            Comece registrando como você está se sentindo
          </p>
        </div>
      )}

      {/* ENTRIES */}
      <div className="px-5 pb-7">
        {Object.entries(grouped).map(([day, dayEntries]) => (
          <div key={day} className="mb-5">
            <p className="text-xs font-semibold text-mapa-pink-deep capitalize mb-2 font-[family-name:var(--font-playfair)] italic">
              {day}
            </p>
            {dayEntries.map((entry) => {
              const mood = MOOD_MAP[entry.mood_emoji] || MOOD_MAP.neutra;
              const isExp = expandedId === entry.id;
              return (
                <div
                  key={entry.id}
                  onClick={() => setExpandedId(isExp ? null : entry.id)}
                  className="bg-mapa-card rounded-[18px] border border-mapa-border/50 border-l-4 border-l-mapa-pink p-3.5 px-4 mb-2.5 cursor-pointer transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[28px]">{mood.emoji}</span>
                      <div>
                        <p className={`text-sm font-semibold ${mood.color}`}>
                          {mood.label}
                        </p>
                        <p className="text-[11px] text-mapa-muted">
                          {new Date(entry.created_at).toLocaleTimeString(
                            "pt-BR",
                            { hour: "2-digit", minute: "2-digit" }
                          )}{" "}
                          · escala {entry.mood_scale || "—"}/10
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-end gap-0.5 h-4">
                        {[1, 2, 3, 4, 5, 6].map((l) => (
                          <div
                            key={l}
                            className={`rounded-[1px] ${l <= (entry.energy_level || 0) ? "bg-mapa-lavender" : "bg-mapa-border"}`}
                            style={{ width: 3, height: 3 + l * 2 }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-mapa-muted">
                        {isExp ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>
                  {!isExp &&
                    ((entry.tags || []).length > 0 ||
                      formatSleepCompact(
                        entry.sleep_quality,
                        entry.sleep_hours
                      ) ||
                      formatScreenTimeCompact(entry.screen_time_hours)) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(entry.tags || []).slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] py-0.5 px-2 rounded-[10px] bg-mapa-pink-light text-mapa-pink-deep"
                          >
                            {t}
                          </span>
                        ))}
                        {(entry.tags || []).length > 4 && (
                          <span className="text-[10px] py-0.5 px-2 rounded-[10px] bg-mapa-border text-mapa-muted">
                            +{entry.tags.length - 4}
                          </span>
                        )}
                        {/* Pílula de sono — Sprint 3.1 */}
                        {formatSleepCompact(
                          entry.sleep_quality,
                          entry.sleep_hours
                        ) && (
                          <span
                            className="text-[10px] py-0.5 px-2 rounded-[10px] bg-mapa-lavender-light"
                            style={{ color: "#5A4A8C" }}
                          >
                            {formatSleepCompact(
                              entry.sleep_quality,
                              entry.sleep_hours
                            )}
                          </span>
                        )}
                        {/* Pílula de tempo de tela — Sprint 3.2 */}
                        {formatScreenTimeCompact(entry.screen_time_hours) && (
                          <span
                            className="text-[10px] py-0.5 px-2 rounded-[10px]"
                            style={{
                              background: "#F5F2F8",
                              color: "#6B6280",
                            }}
                          >
                            {formatScreenTimeCompact(entry.screen_time_hours)}
                          </span>
                        )}
                      </div>
                    )}
                  {isExp && (
                    <div
                      className="mt-3.5 pt-3 border-t border-mapa-border/50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Sono — Sprint 3.1 (cronológico: vem antes dos sentimentos) */}
                      {formatSleepFull(
                        entry.sleep_quality,
                        entry.sleep_hours
                      ) && (
                        <div className="mb-3">
                          <p
                            className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                            style={{ color: "#5A4A8C" }}
                          >
                            Sono
                          </p>
                          <span
                            className="inline-block text-[12px] py-1.5 px-3.5 rounded-[14px] font-medium"
                            style={{
                              background: "#F3EEFF",
                              color: "#5A4A8C",
                              border: "1px solid rgba(184, 169, 212, 0.5)",
                            }}
                          >
                            {formatSleepFull(
                              entry.sleep_quality,
                              entry.sleep_hours
                            )}
                          </span>
                        </div>
                      )}
                      {/* Tempo de tela — Sprint 3.2 */}
                      {formatScreenTimeFull(entry.screen_time_hours) && (
                        <div className="mb-3">
                          <p
                            className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                            style={{ color: "#6B6280" }}
                          >
                            Tempo de tela
                          </p>
                          <span
                            className="inline-block text-[12px] py-1.5 px-3.5 rounded-[14px] font-medium"
                            style={{
                              background: "#F5F2F8",
                              color: "#6B6280",
                              border: "1px solid rgba(168, 155, 188, 0.4)",
                            }}
                          >
                            {formatScreenTimeFull(entry.screen_time_hours)}
                          </span>
                        </div>
                      )}
                      {(entry.tags || []).length > 0 && (
                        <div className="mb-3">
                          <p className="text-[11px] font-semibold text-mapa-pink-deep uppercase tracking-wide mb-1.5">
                            Sentimentos
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {entry.tags.map((t) => (
                              <span
                                key={t}
                                className="text-[11px] py-1 px-3 rounded-[14px] bg-mapa-pink-light text-mapa-pink-deep font-medium"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(entry.activities || []).length > 0 && (
                        <div className="mb-3">
                          <p className="text-[11px] font-semibold text-mapa-pink-deep uppercase tracking-wide mb-1.5">
                            Atividades
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {entry.activities.map((a) => (
                              <span
                                key={a}
                                className="text-[11px] py-1 px-3 rounded-[14px] bg-mapa-lavender-light text-[#6B5B95] font-medium"
                              >
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {entry.note && (
                        <div className="mb-3">
                          <p className="text-[11px] font-semibold text-mapa-pink-deep uppercase tracking-wide mb-1.5">
                            Nota pessoal
                          </p>
                          <p className="text-[13px] leading-relaxed text-mapa-text italic">
                            &ldquo;{entry.note}&rdquo;
                          </p>
                        </div>
                      )}
                      {entry.audio_url && (
                        <div className="mb-3">
                          <button
                            onClick={() =>
                              toggleAudio(entry.id, entry.audio_url!)
                            }
                            className="py-2 px-4 rounded-[14px] border-[1.5px] border-mapa-pink bg-mapa-pink-light text-xs font-semibold text-mapa-pink-deep cursor-pointer font-[family-name:var(--font-quicksand)]"
                          >
                            {playingAudioId === entry.id
                              ? "⏸ Pausar"
                              : "▶️ Ouvir áudio"}
                          </button>
                        </div>
                      )}
                      {entry.ai_feedback && (
                        <div className="bg-mapa-mint-light rounded-[14px] p-3 px-3.5">
                          <p className="text-[10px] font-semibold text-[#5BA67D] uppercase tracking-wide mb-1">
                            🌿 Lis disse:
                          </p>
                          <p className="text-xs leading-relaxed text-mapa-text">
                            {entry.ai_feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
