// screens/ProfileScreen.tsx — 내 프로필 홈 (core-spec §5, §2.8)
import React from 'react';
import {
  View, Text, Pressable, Switch, ScrollView, StyleSheet, Modal, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space, radius, type, card } from '../theme/tokens';
import { useSession } from '../context/SessionContext';

export default function ProfileScreen({ navigation }: any) {
  const { school, user } = useSession();
  const [mealPush, setMealPush] = React.useState(true);
  const [hotPush, setHotPush] = React.useState(false);
  const [withdraw, setWithdraw] = React.useState(false);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>
        <Text style={s.h1}>내 프로필</Text>

        {/* 프로필 헤더 */}
        <View style={s.card}>
          <View style={s.profileRow}>
            <View style={s.avatar}><Text style={{ fontSize: 26 }}>🙂</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={type.title}>
                {user.nickname}{user.isGraduate ? ' 🎓' : ''}
              </Text>
              <Text style={type.caption}>{school.school_name} · {school.grade ?? '-'}학년</Text>
            </View>
          </View>
        </View>

        {/* 활동 */}
        <View style={s.card}>
          <Row label="내가 쓴 글" onPress={() => navigation.navigate('MyPosts')} />
          <Divider />
          <Row label="스크랩함" onPress={() => navigation.navigate('Scraps')} />
        </View>

        {/* 알림 설정 */}
        <View style={s.card}>
          <Text style={[type.caption, { marginBottom: space.sm }]}>알림</Text>
          <ToggleRow label="오늘 급식 알림" value={mealPush} onChange={setMealPush} />
          <Divider />
          <ToggleRow label="우리 학교 인기글 알림" value={hotPush} onChange={setHotPush} />
        </View>

        {/* 지원 */}
        <View style={s.card}>
          <Row label="문의하기" hint="운영팀에 메일"
            onPress={() => Linking.openURL('mailto:support@catchup.kr?subject=%5BCatchup%5D%20%EB%AC%B8%EC%9D%98')} />
          <Divider />
          <Row label="회원 탈퇴" danger onPress={() => setWithdraw(true)} />
        </View>
      </ScrollView>

      <WithdrawModal visible={withdraw} onClose={() => setWithdraw(false)} />
    </SafeAreaView>
  );
}

function Row({ label, hint, danger, onPress }: { label: string; hint?: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable style={s.row} onPress={onPress}>
      <Text style={[type.body, danger && { color: colors.danger }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {!!hint && <Text style={type.caption}>{hint}</Text>}
        <Text style={{ color: colors.inkSub, fontSize: 18 }}>›</Text>
      </View>
    </Pressable>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.row}>
      <Text style={type.body}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.line }} thumbColor="#fff" />
    </View>
  );
}

const Divider = () => <View style={s.divider} />;

// 회원 탈퇴 — 작성글 처리 선택(기본 남김) + 최종 확인 (core-spec §2.8)
function WithdrawModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [keepPosts, setKeepPosts] = React.useState(true);

  const confirm = () => {
    Alert.alert(
      '정말 탈퇴할까요?',
      keepPosts ? '작성한 글은 남겨둡니다.' : '작성한 글이 모두 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '탈퇴', style: 'destructive', onPress: () => { onClose(); Alert.alert('탈퇴 처리(데모)', '실제 서비스에서는 여기서 탈퇴가 완료돼요.'); } },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={type.title}>회원 탈퇴</Text>
          <Text style={[type.body, { color: colors.inkSub, marginTop: space.sm, marginBottom: space.lg }]}>
            그동안 작성한 글을 어떻게 할까요?
          </Text>

          <Pressable style={[s.choice, keepPosts && s.choiceOn]} onPress={() => setKeepPosts(true)}>
            <Text style={[type.body, keepPosts && { color: colors.accent, fontWeight: '700' }]}>작성한 글 남기기</Text>
            <Text style={type.caption}>기본값 · 다른 학생들에게 도움이 될 수 있어요</Text>
          </Pressable>
          <Pressable style={[s.choice, !keepPosts && s.choiceOn]} onPress={() => setKeepPosts(false)}>
            <Text style={[type.body, !keepPosts && { color: colors.accent, fontWeight: '700' }]}>작성한 글 모두 삭제</Text>
          </Pressable>

          <View style={s.modalBtns}>
            <Pressable style={[s.btn, s.btnGhost]} onPress={onClose}><Text style={type.body}>취소</Text></Pressable>
            <Pressable style={[s.btn, s.btnDanger]} onPress={confirm}><Text style={{ color: '#fff', fontWeight: '700' }}>탈퇴하기</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  h1: { ...type.display, fontSize: 24, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  card,
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md },
  divider: { height: 1, backgroundColor: colors.line },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: space.lg, paddingBottom: space.xl },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, padding: space.md, marginBottom: space.sm },
  choiceOn: { borderColor: colors.accent, backgroundColor: '#FFFDF4' },
  modalBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  btn: { flex: 1, borderRadius: radius.button, paddingVertical: space.md, alignItems: 'center' },
  btnGhost: { backgroundColor: colors.bg },
  btnDanger: { backgroundColor: colors.danger },
});
