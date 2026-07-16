// screens/onboarding/OnboardingFlow.tsx — 학생증 인증 온보딩 (4스텝, 단일 화면)
// 검색 → 정보 → 학생증 → 검수/완료. 승인 시 SessionContext.completeVerification 호출.

import React from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet,
  ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, space, radius, type, card } from '../../theme/tokens';
import { useSession } from '../../context/SessionContext';
import { searchSchools, type SchoolHit } from '../../lib/schools';
import { submitVerification } from '../../lib/verification';

type Step = 'search' | 'info' | 'idcard' | 'review';

export default function OnboardingFlow() {
  const { completeVerification } = useSession();
  const [step, setStep] = React.useState<Step>('search');

  // step: search
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<SchoolHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [school, setSchool] = React.useState<SchoolHit | null>(null);

  // step: info
  const [name, setName] = React.useState('');
  const [grade, setGrade] = React.useState<1 | 2 | 3>(3);
  const [ageOk, setAgeOk] = React.useState(false);   // 만 14세 이상 확인 (4-6)
  const [policyOk, setPolicyOk] = React.useState(false);

  // step: idcard
  const [imageUri, setImageUri] = React.useState<string | null>(null);

  // step: review
  const [reviewMsg, setReviewMsg] = React.useState('학생증을 확인하고 있어요…');

  const doSearch = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setHits([]); return; }
    setSearching(true);
    setHits(await searchSchools(q));
    setSearching(false);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('사진 접근 권한이 필요해요', '설정에서 허용해 주세요.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) setImageUri(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('카메라 권한이 필요해요', '설정에서 허용해 주세요.'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) setImageUri(res.assets[0].uri);
  };

  const submit = async () => {
    if (!school) return;
    setStep('review');
    const result = await submitVerification({ school, name, grade, imageUri });
    if (result.status === 'approved') {
      setReviewMsg('인증 완료! 입장할게요 🎉');
      setTimeout(() => {
        completeVerification({ ...school, grade }, name.trim() || '학생');
      }, 700);
    } else if (result.status === 'rejected') {
      Alert.alert('인증에 실패했어요', result.reason);
      setStep('idcard');
    } else {
      setReviewMsg('검수 대기 중이에요. 승인되면 알림으로 알려드릴게요.');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* 브랜드 헤더 */}
        <View style={s.brand}>
          <Text style={s.logo}>Catchup</Text>
          <Text style={type.caption}>놓친 우리 학교 소식, Catchup 해</Text>
        </View>

        {/* 진행 표시 */}
        <View style={s.progress}>
          {(['search', 'info', 'idcard', 'review'] as Step[]).map((st2, i) => (
            <View key={st2} style={[s.dot, step === st2 && s.dotOn,
              (['search','info','idcard','review'] as Step[]).indexOf(step) > i && s.dotDone]} />
          ))}
        </View>

        {/* STEP 1 — 학교 검색 */}
        {step === 'search' && (
          <View style={s.body}>
            <Text style={s.h}>어느 학교에 다니고 있나요?</Text>
            <TextInput
              style={s.input} placeholder="학교 이름 검색 (2글자 이상)"
              placeholderTextColor={colors.inkSub} value={query} onChangeText={doSearch} autoFocus
            />
            {searching && <ActivityIndicator color={colors.accent} style={{ marginTop: space.md }} />}
            <FlatList
              data={hits}
              keyExtractor={(h2) => h2.school_code}
              style={{ marginTop: space.sm }}
              renderItem={({ item }) => (
                <Pressable style={s.hit} onPress={() => { setSchool(item); setStep('info'); }}>
                  <Text style={type.body}>{item.school_name}</Text>
                  <Text style={type.caption}>{item.region} · {item.address}</Text>
                </Pressable>
              )}
              ListEmptyComponent={query.trim().length >= 2 && !searching
                ? <Text style={s.emptyTxt}>검색 결과가 없어요.</Text> : null}
            />
          </View>
        )}

        {/* STEP 2 — 기본 정보 + 동의 */}
        {step === 'info' && school && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={s.h}>{school.school_name}</Text>
            <Text style={[type.caption, { marginBottom: space.lg }]}>{school.region} · {school.address}</Text>

            <Text style={s.label}>이름 (학생증과 동일하게)</Text>
            <TextInput style={s.input} placeholder="본명 입력" placeholderTextColor={colors.inkSub}
              value={name} onChangeText={setName} />

            <Text style={[s.label, { marginTop: space.lg }]}>학년</Text>
            <View style={s.gradeRow}>
              {[1, 2, 3].map((g2) => (
                <Pressable key={g2} style={[s.gradeBtn, grade === g2 && s.gradeOn]} onPress={() => setGrade(g2 as 1|2|3)}>
                  <Text style={[type.body, grade === g2 && { color: '#fff', fontWeight: '700' }]}>{g2}학년</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={s.agree} onPress={() => setAgeOk((v) => !v)}>
              <Text style={{ fontSize: 18, color: ageOk ? colors.accent : colors.inkSub }}>{ageOk ? '☑' : '☐'}</Text>
              <Text style={[type.body, { flex: 1 }]}> 만 14세 이상입니다.</Text>
            </Pressable>
            <Pressable style={s.agree} onPress={() => setPolicyOk((v) => !v)}>
              <Text style={{ fontSize: 18, color: policyOk ? colors.accent : colors.inkSub }}>{policyOk ? '☑' : '☐'}</Text>
              <Text style={[type.body, { flex: 1 }]}> 이용약관·개인정보처리방침에 동의합니다.</Text>
            </Pressable>

            <Pressable
              style={[s.cta, !(name.trim() && ageOk && policyOk) && s.ctaOff]}
              disabled={!(name.trim() && ageOk && policyOk)}
              onPress={() => setStep('idcard')}
            >
              <Text style={s.ctaTxt}>다음</Text>
            </Pressable>
            <Pressable onPress={() => setStep('search')} style={{ marginTop: space.md, alignItems: 'center' }}>
              <Text style={type.caption}>학교 다시 선택</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* STEP 3 — 학생증 제출 */}
        {step === 'idcard' && school && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={s.h}>학생증으로 재학생임을 확인해요</Text>
            <Text style={[type.caption, { lineHeight: 18, marginBottom: space.lg }]}>
              학생증 이미지는 재학 인증에만 사용되고, 인증 결과와 관계없이 30일 이내에 완전히 파기돼요.
            </Text>

            {imageUri ? (
              <View>
                <Image source={{ uri: imageUri }} style={s.preview} resizeMode="cover" />
                <Pressable onPress={() => setImageUri(null)} style={{ alignItems: 'center', marginTop: space.sm }}>
                  <Text style={[type.caption, { color: colors.accent }]}>다시 선택</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.pickRow}>
                <Pressable style={s.pickBtn} onPress={takePhoto}>
                  <Text style={{ fontSize: 28 }}>📷</Text><Text style={type.body}>촬영하기</Text>
                </Pressable>
                <Pressable style={s.pickBtn} onPress={pickImage}>
                  <Text style={{ fontSize: 28 }}>🖼️</Text><Text style={type.body}>앨범에서 선택</Text>
                </Pressable>
              </View>
            )}

            <Pressable style={[s.cta, { marginTop: space.xl }]} onPress={submit}>
              <Text style={s.ctaTxt}>{imageUri ? '제출하고 인증받기' : '데모: 이미지 없이 인증 진행'}</Text>
            </Pressable>
            <Pressable onPress={() => setStep('info')} style={{ marginTop: space.md, alignItems: 'center' }}>
              <Text style={type.caption}>이전으로</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* STEP 4 — 검수 */}
        {step === 'review' && (
          <View style={[s.body, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[type.title, { marginTop: space.lg }]}>{reviewMsg}</Text>
            <Text style={[type.caption, { marginTop: space.sm }]}>보통 몇 초면 끝나요</Text>
          </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  brand: { alignItems: 'center', paddingTop: space.xl, paddingBottom: space.md },
  logo: { fontSize: 32, fontWeight: '800', color: colors.accent, letterSpacing: -0.5 },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginBottom: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.accent, width: 20 },
  dotDone: { backgroundColor: colors.accentDeep },
  body: { paddingHorizontal: space.lg, paddingBottom: space.xl, flexGrow: 1 },
  h: { ...type.title, fontSize: 20, marginBottom: space.md },
  label: { ...type.caption, marginBottom: space.sm },
  input: { ...type.body, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, paddingHorizontal: space.md, paddingVertical: 12 },
  hit: { ...card, marginHorizontal: 0, paddingVertical: space.md },
  emptyTxt: { ...type.body, color: colors.inkSub, textAlign: 'center', marginTop: space.xl },
  gradeRow: { flexDirection: 'row', gap: space.sm },
  gradeBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.button, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  gradeOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  agree: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  cta: { backgroundColor: colors.accent, borderRadius: radius.button, paddingVertical: 14, alignItems: 'center', marginTop: space.xl },
  ctaOff: { opacity: 0.4 },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pickRow: { flexDirection: 'row', gap: space.md },
  pickBtn: { flex: 1, aspectRatio: 1.3, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  preview: { width: '100%', aspectRatio: 1.586, borderRadius: radius.card, backgroundColor: colors.line },
});
