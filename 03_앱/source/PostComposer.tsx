// components/community/PostComposer.tsx
import React from 'react';
import {
  Modal, View, Text, TextInput, Pressable, Switch, StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { colors, space, radius, type } from '../../theme/tokens';
import { TAGS, type Tag, preCheckPost } from '../../lib/community';

export default function PostComposer({
  visible, onClose, onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (v: { tag: Tag; body: string; isAnonymous: boolean }) => void;
}) {
  const [tag, setTag] = React.useState<Tag>(TAGS[0]);
  const [body, setBody] = React.useState('');
  const [anon, setAnon] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const reset = () => { setTag(TAGS[0]); setBody(''); setAnon(false); };

  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    // 게시 전 AI 필터 (safe/warn/block)
    const check = await preCheckPost(body);
    setBusy(false);
    if (check.verdict === 'block') {
      Alert.alert('게시할 수 없어요', check.reason ?? '커뮤니티 가이드라인에 어긋나는 표현이 감지됐어요.');
      return;
    }
    onSubmit({ tag, body: body.trim(), isAnonymous: anon });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheet}>
            <View style={s.headerRow}>
              <Pressable onPress={() => { reset(); onClose(); }}><Text style={type.body}>취소</Text></Pressable>
              <Text style={type.title}>새 글</Text>
              <Pressable onPress={submit} disabled={!body.trim() || busy}>
                <Text style={[type.body, { color: body.trim() && !busy ? colors.accent : colors.inkSub, fontWeight: '700' }]}>
                  {busy ? '확인중…' : '등록'}
                </Text>
              </Pressable>
            </View>

            {/* 태그 선택 */}
            <View style={[s.tagRow]}>
              {TAGS.map((t) => (
                <Pressable key={t} onPress={() => setTag(t)} style={[s.tag, tag === t && s.tagOn]}>
                  <Text style={[type.caption, tag === t && { color: '#fff' }]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            {/* 본문 */}
            <TextInput
              style={s.input} multiline placeholder="무슨 이야기를 나눠볼까요?"
              placeholderTextColor={colors.inkSub} value={body} onChangeText={setBody} autoFocus
            />

            {/* 익명 토글 */}
            <View style={s.anonRow}>
              <Text style={type.body}>익명으로 쓰기</Text>
              <Switch value={anon} onValueChange={setAnon}
                trackColor={{ true: colors.accent, false: colors.line }} thumbColor="#fff" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: space.lg, paddingBottom: space.xl,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  tag: {
    borderRadius: radius.chip, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: space.md, paddingVertical: 6,
  },
  tagOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  input: {
    ...type.body, minHeight: 120, textAlignVertical: 'top',
    backgroundColor: colors.bg, borderRadius: radius.card, padding: space.md, marginBottom: space.md,
  },
  anonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
