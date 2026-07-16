// screens/AdmissionScreen.tsx — 입시 정보 탭 (core-spec §3)
import React from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space, radius, type, card } from '../theme/tokens';
import {
  seedRows, newRow, computeGpa, MOCK_CUTS, UNIVERSITIES, admissionSearchUrl, type GpaRow,
} from '../lib/admission';

export default function AdmissionScreen() {
  const [rows, setRows] = React.useState<GpaRow[]>(seedRows());
  const g = computeGpa(rows);

  const patch = (id: string, p: Partial<GpaRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const step = (id: string, key: 'units' | 'grade', d: number, min: number, max: number) =>
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, [key]: Math.min(max, Math.max(min, r[key] + d)) } : r));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>
        <Text style={s.h1}>입시 정보</Text>

        {/* 내신 계산기 */}
        <View style={s.card}>
          <View style={s.rowB}>
            <Text style={type.title}>내신 등급 계산기</Text>
            <Text style={type.caption}>{g.count}과목 · {g.totalUnits}단위</Text>
          </View>

          {/* 결과 */}
          <View style={s.result}>
            <Text style={s.resultNum}>{g.avg ? g.avg.toFixed(2) : '-'}</Text>
            <Text style={type.caption}>선택 과목 가중평균 등급</Text>
          </View>

          {/* 표 헤더 */}
          <View style={[s.rowH]}>
            <Text style={[s.th, { flex: 1 }]}>과목</Text>
            <Text style={[s.th, { width: 96, textAlign: 'center' }]}>단위</Text>
            <Text style={[s.th, { width: 96, textAlign: 'center' }]}>등급</Text>
            <Text style={[s.th, { width: 36 }]} />
          </View>

          {rows.map((r) => (
            <View key={r.id} style={[s.rowR, !r.include && { opacity: 0.4 }]}>
              <TextInput
                style={[s.name, { flex: 1 }]} value={r.name} placeholder="과목명"
                placeholderTextColor={colors.inkSub} onChangeText={(t) => patch(r.id, { name: t })}
              />
              <Stepper value={r.units} onMinus={() => step(r.id, 'units', -1, 1, 8)} onPlus={() => step(r.id, 'units', 1, 1, 8)} />
              <Stepper value={r.grade} onMinus={() => step(r.id, 'grade', -1, 1, 9)} onPlus={() => step(r.id, 'grade', 1, 1, 9)} />
              <Pressable onPress={() => patch(r.id, { include: !r.include })} style={s.chk}>
                <Text style={{ color: r.include ? colors.accent : colors.inkSub, fontSize: 18 }}>{r.include ? '☑' : '☐'}</Text>
              </Pressable>
            </View>
          ))}

          <View style={s.rowB}>
            <Pressable onPress={() => setRows((rs) => [...rs, newRow()])} style={s.addBtn}>
              <Text style={[type.body, { color: colors.accent }]}>＋ 과목 추가</Text>
            </Pressable>
            <Pressable onPress={() => setRows(seedRows())}>
              <Text style={type.caption}>초기화</Text>
            </Pressable>
          </View>
          <Text style={[type.caption, { marginTop: space.sm }]}>체크 해제로 특정 과목(예: 국영수만)만 계산할 수 있어요.</Text>
        </View>

        {/* 모의고사 컷 */}
        <View style={s.card}>
          <Text style={type.title}>모의고사 등급컷</Text>
          <Text style={[type.caption, { marginBottom: space.md }]}>{MOCK_CUTS.label}</Text>
          {MOCK_CUTS.subjects.map((sub) => (
            <View key={sub.name} style={{ marginBottom: space.md }}>
              <Text style={[type.body, { fontWeight: '700', marginBottom: 4 }]}>{sub.name}</Text>
              {sub.cuts.map(([g2, raw]) => (
                <View key={g2} style={s.cutRow}>
                  <Text style={type.caption}>{g2}</Text>
                  <Text style={[type.body, { fontVariant: ['tabular-nums'] }]}>{raw}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* 모집요강 링크 */}
        <View style={s.card}>
          <Text style={type.title}>대학 모집요강 바로가기</Text>
          <Text style={[type.caption, { marginBottom: space.md }]}>대학을 누르면 최신 입학처·모집요강 검색이 열려요.</Text>
          <View style={s.uniWrap}>
            {UNIVERSITIES.map((u) => (
              <Pressable key={u} style={s.uni} onPress={() => Linking.openURL(admissionSearchUrl(u))}>
                <Text style={type.body}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stepper({ value, onMinus, onPlus }: { value: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={st.wrap}>
      <Pressable onPress={onMinus} style={st.btn}><Text style={st.sign}>－</Text></Pressable>
      <Text style={st.val}>{value}</Text>
      <Pressable onPress={onPlus} style={st.btn}><Text style={st.sign}>＋</Text></Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { width: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  sign: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  val: { ...type.body, fontWeight: '700', minWidth: 20, textAlign: 'center' },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  h1: { ...type.display, fontSize: 24, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  card,
  rowB: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowH: { flexDirection: 'row', alignItems: 'center', marginTop: space.md, marginBottom: space.sm },
  rowR: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: space.sm },
  th: { ...type.caption },
  result: { alignItems: 'center', paddingVertical: space.md, backgroundColor: colors.bg, borderRadius: radius.card, marginTop: space.md },
  resultNum: { ...type.display, color: colors.accent },
  name: { ...type.body, backgroundColor: colors.bg, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: 6 },
  chk: { width: 36, alignItems: 'center' },
  addBtn: { paddingVertical: space.sm },
  cutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  uniWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  uni: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: 8 },
});
