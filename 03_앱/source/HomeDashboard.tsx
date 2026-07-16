// screens/HomeDashboard.tsx — 나의 학교(홈) 대시보드
// 각 카드 독립 로딩. pull-to-refresh = 케첩 짜기 시그니처(주홍 tint).

import React from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '../theme/tokens';
import {
  fetchMeal, fetchSchedule, fetchTimetable,
  type School, type MealSlot, type ScheduleEvent, type TimetableItem,
} from '../lib/neis';
import { fetchHotPosts, type HotPost } from '../lib/supabaseClient';
import {
  GreetingHeader, TimetableCard, BannerCard, MealCard, ScheduleDdayCard, HotPostsCard,
} from '../components/HomeCards';

// 데모용 학교. 실제로는 인증 세션에서 주입.
const DEMO_SCHOOL: School = {
  school_code: 'DEMO0001', office_code: 'B10',
  school_name: '금천고등학교', grade: 3, class_nm: '4',
};

export default function HomeDashboard({ school = DEMO_SCHOOL }: { school?: School }) {
  const [meal, setMeal] = React.useState<MealSlot[]>([]);
  const [sched, setSched] = React.useState<ScheduleEvent[]>([]);
  const [table, setTable] = React.useState<TimetableItem[]>([]);
  const [hot, setHot] = React.useState<HotPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    // 카드별 독립: 하나가 실패해도 나머지는 채운다.
    const [m, s, t, h] = await Promise.allSettled([
      fetchMeal(school), fetchSchedule(school), fetchTimetable(school),
      fetchHotPosts(school.school_code),
    ]);
    if (m.status === 'fulfilled') setMeal(m.value);
    if (s.status === 'fulfilled') setSched(s.value);
    if (t.status === 'fulfilled') setTable(t.value);
    if (h.status === 'fulfilled') setHot(h.value);
  }, [school]);

  React.useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}     // iOS 케첩 방울
            colors={[colors.accent]}      // Android
          />
        }
      >
        <GreetingHeader school={school} />
        <TimetableCard items={table} loading={loading} />
        <BannerCard banner={null} />
        <MealCard slots={meal} loading={loading} />
        <ScheduleDdayCard events={sched} loading={loading} />
        <HotPostsCard posts={hot} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg } });
