"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

const MOOD_MAP: Record<
  string,
  { emoji: string; label: string; color: string }
> = {
  pessima: { emoji: "😣", label: "Péssima", color: "text-mapa-coral" },
  mal: { emoji: "😒", label: "Mal", color: "text-[#D4A574]" },
  neutra: { emoji: "😐", label: "Neutra", color: "text-mapa-muted" },
  bem: { emoji: "😊", label: "Bem", color: "text-mapa-mint" },
  otima: { emoji: "🥰", label: "Ótima", color: "text-mapa-pink" },
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
}

export default function MoodHistory() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();
    if (profile?.name) setUserName(profile.name);

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
        <h1 className="font-[family-name:var(--font-playfair)] text-[22px] font-medium">
          Meus registros 📖
        </h1>
        <p className="text-[13px] text-mapa-pink-deep mt-1 font-[family-name:var(--font-playfair)] italic">
          Os caminhos da {userName || "..."}
        </p>
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
                  {!isExp && (entry.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entry.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] py-0.5 px-2 rounded-[10px] bg-mapa-pink-light text-mapa-pink-deep"
                        >
                          {t}
                        </span>
                      ))}
                      {entry.tags.length > 4 && (
                        <span className="text-[10px] py-0.5 px-2 rounded-[10px] bg-mapa-border text-mapa-muted">
                          +{entry.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                  {isExp && (
                    <div
                      className="mt-3.5 pt-3 border-t border-mapa-border/50"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                            🌿 Mapa IA disse:
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
