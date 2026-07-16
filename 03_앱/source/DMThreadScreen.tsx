// screens/DMThreadScreen.tsx — 1:1 쪽지 스레드 (core-spec §2.5, §2.6)
import React from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space, radius, type } from '../theme/tokens';
import { fetchThread, sendMessage, type Message } from '../lib/messages';

export default function DMThreadScreen({ route }: any) {
  const { convId, isAdmin } = route.params;
  const [msgs, setMsgs] = React.useState<Message[]>([]);
  const [body, setBody] = React.useState('');
  const listRef = React.useRef<FlatList<Message>>(null);

  React.useEffect(() => { fetchThread(convId).then(setMsgs); }, [convId]);

  const send = async () => {
    if (!body.trim()) return;
    const m = await sendMessage(convId, body);
    setMsgs((ms) => [...ms, m]);
    setBody('');
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {isAdmin && (
        <View style={s.notice}>
          <Text style={[type.caption, { color: colors.admin }]}>공지·문의 전용 채널이에요. 남겨주시면 확인 후 안내드립니다.</Text>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View style={[s.bubbleRow, { justifyContent: item.fromMe ? 'flex-end' : 'flex-start' }]}>
            <View style={[
              s.bubble,
              item.fromMe ? s.mine : (isAdmin ? s.admin : s.theirs),
            ]}>
              <Text style={[type.body, item.fromMe && { color: '#fff' }]}>{item.body}</Text>
            </View>
          </View>
        )}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.inputBar}>
          <TextInput
            style={s.input} placeholder="메시지 입력…" placeholderTextColor={colors.inkSub}
            value={body} onChangeText={setBody} multiline
          />
          <Pressable onPress={send} disabled={!body.trim()} style={[s.sendBtn, !body.trim() && { opacity: 0.4 }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>전송</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  notice: { backgroundColor: '#FFF9EC', paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomColor: colors.line, borderBottomWidth: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '78%', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 16 },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderBottomLeftRadius: 4 },
  admin: { backgroundColor: '#FBEFD0', borderBottomLeftRadius: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1 },
  input: { ...type.body, flex: 1, maxHeight: 100, backgroundColor: colors.bg, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: space.sm },
  sendBtn: { backgroundColor: colors.accent, borderRadius: radius.button, paddingHorizontal: space.lg, paddingVertical: space.sm },
});
