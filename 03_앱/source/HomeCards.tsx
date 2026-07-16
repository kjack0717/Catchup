// components/HomeCards.tsx — 홈 대시보드 카드 C1–C6
// 각 카드는 독립 로딩·실패 격리. 빈/실패는 카드 안에서 브랜드 톤 카피로.

import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { colors, space, type, card, radius } from '../theme/tokens';
import {
  SUNEUNG_DATE, dday, nextExam,
  type MealSlot, type ScheduleEvent, type TimetableItem, type School,
} from '../lib/neis';
import type { HotPost } from '../lib/supabaseClient';

const s = StyleSheet.create({
  card,
  cardTitle: { ...type.title, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  muted: { ...type.caption },
  empty: { ...type.body, color: colors.inkSub },
  ddayNum: { ...type.display, color: colors.accent },
  chip: {
    backgroundColor: colors.bg, borderColor: colors.line, borderWidth: 1,
    borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: 4, marginRight: space.sm,
  },
});

const Loading = () => <ActivityIndicator color={colors.accent} style={{ paddingVertical: space.md }} />;

// C1 — 인사 + 수능 D-day
export function GreetingHeader({ school }: { school: School }) {
  const d = dday(SUNEUNG_DATE);
  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>
      <Text style={type.caption}>{school.school_name} · {school.grade ?? 3}학년</Text>
      <View style={[s.row, { alignItems: 'baseline', marginTop: 2 }]}>
        <Text style={s.ddayNum}>{d >= 0 ? `수능 D-${d}` : '수능 종료'}</Text>
      </View>
    </View>
  );
}

// C2 — 오늘 시간표
export function TimetableCard({ items, loading }: { items: TimetableItem[]; loading: boolean }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>📅 오늘 시간표</Text>
      {loading ? <Loading /> : items.length === 0 ? (
        <Text style={s.empty}>오늘은 등록된 시간표가 없어요.</Text>
      ) : (
        <View style={[s.row, { flexWrap: 'wrap', gap: space.sm as any }]}>
          {items.map((t) => (
            <Text key={t.period} style={type.body}>{t.period} {t.subject}   </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// C3 — 배너(없으면 렌더 안 함)
export function BannerCard({ banner }: { banner?: { title: string } | null }) {
  if (!banner) return null;
  return (
    <View style={[s.card, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
      <Text style={[type.title, { color: '#fff' }]}>{banner.title}</Text>
    </View>
  );
}

// C4 — 급식 (조/중/석 탭)
export function MealCard({ slots, loading }: { slots: MealSlot[]; loading: boolean }) {
  const [idx, setIdx] = React.useState(0);
  const active = slots[idx];
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>🍚 오늘 급식</Text>
      {loading ? <Loading /> : slots.length === 0 ? (
        <Text style={s.empty}>오늘은 급식 정보가 없어요. (주말·휴일)</Text>
      ) : (
        <>
          {slots.length > 1 && (
            <View style={[s.row, { marginBottom: space.md }]}>
              {slots.map((m, i) => (
                <Pressable key={m.name} onPress={() => setIdx(i)}
                  style={[s.chip, i === idx && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                  <Text style={[type.caption, i === idx && { color: '#fff' }]}>{m.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Text style={type.body}>{active?.menu.join(' · ')}</Text>
          {!!active?.kcal && <Text style={[type.caption, { marginTop: space.sm }]}>약 {active.kcal}</Text>}
        </>
      )}
    </View>
  );
}

// C5 — 학사일정 D-day (가장 가까운 시험)
export function ScheduleDdayCard({ events, loading }: { events: ScheduleEvent[]; loading: boolean }) {
  const exam = nextExam(events);
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>🗓 학사일정</Text>
      {loading ? <Loading /> : !exam ? (
        <Text style={s.empty}>다가오는 시험 일정이 없어요.</Text>
      ) : (
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={type.body}>{exam.title}</Text>
          <Text style={[type.title, { color: exam.d <= 7 ? colors.danger : colors.accent }]}>
            D-{exam.d}
          </Text>
        </View>
      )}
    </View>
  );
}

// C6 — 우리 학교 인기글 상위 3
export function HotPostsCard({ posts, loading }: { posts: HotPost[]; loading: boolean }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>🔥 우리 학교 인기글</Text>
      {loading ? <Loading /> : posts.length === 0 ? (
        <Text style={s.empty}>아직 짜낸 소식이 없어요. 당겨서 새로고침 해보세요.</Text>
      ) : (
        posts.map((p, i) => (
          <View key={p.id} style={[s.row, { justifyContent: 'space-between', marginBottom: space.sm }]}>
            <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{i + 1}. {p.title}</Text>
            <Text style={s.muted}>♡{p.likes} 💬{p.comments}</Text>
          </View>
        ))
      )}
    </View>
  );
}
