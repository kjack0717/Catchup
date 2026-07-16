// screens/PostDetailScreen.tsx — 글 상세 + 댓글/대댓글 (core-spec §2.2, §2.4)
import React from 'react';
import {
  View, Text, TextInput, Pressable, Switch, StyleSheet, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space, radius, type, card } from '../theme/tokens';
import { useSession } from '../context/SessionContext';
import { ago, type Post } from '../lib/community';
import {
  fetchComments, addComment, buildAnonLabels, type Comment,
} from '../lib/comments';

type Row = { comment: Comment; depth: 0 | 1; label: string };

export default function PostDetailScreen({ route }: any) {
  const post: Post = route.params.post;
  const { user } = useSession();
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [body, setBody] = React.useState('');
  const [anon, setAnon] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<Comment | null>(null);

  React.useEffect(() => { fetchComments(post.id).then(setComments); }, [post.id]);

  const labels = React.useMemo(() => buildAnonLabels(post, comments), [post, comments]);

  // 댓글 → 대댓글 순서로 평탄화
  const rows: Row[] = React.useMemo(() => {
    const tops = comments.filter((c) => !c.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const out: Row[] = [];
    for (const t of tops) {
      out.push({ comment: t, depth: 0, label: labels[t.authorId] });
      comments.filter((c) => c.parentId === t.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .forEach((r) => out.push({ comment: r, depth: 1, label: labels[r.authorId] }));
    }
    return out;
  }, [comments, labels]);

  const submit = async () => {
    if (!body.trim()) return;
    const c = await addComment(post.id, {
      parentId: replyTo ? replyTo.id : null,
      userId: user.id, isAnonymous: anon, nickname: user.nickname, body,
    });
    setComments((cs) => [...cs, c]);
    setBody(''); setReplyTo(null);
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.comment.id}
        ListHeaderComponent={
          <View style={s.postBox}>
            <View style={s.rowC}>
              <View style={s.tag}><Text style={[type.caption, { color: colors.accentDeep }]}>#{post.tag}</Text></View>
              <Text style={[type.caption, { marginLeft: space.sm }]}>
                {post.isAnonymous ? '글쓴이' : post.authorLabel}{post.isGraduate ? ' 🎓' : ''} · {ago(post.createdAt)}
              </Text>
            </View>
            <Text style={[type.body, { marginTop: space.sm, lineHeight: 22 }]}>{post.body}</Text>
            <Text style={[type.caption, { marginTop: space.md }]}>♡ {post.likes}   💬 {rows.length}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[s.comment, item.depth === 1 && s.reply]}>
            <View style={s.rowC}>
              <Text style={s.author}>{item.label}</Text>
              <Text style={[type.caption, { marginLeft: space.sm }]}>{ago(item.comment.createdAt)}</Text>
            </View>
            <Text style={[type.body, { marginTop: 2 }]}>{item.comment.body}</Text>
            {item.depth === 0 && (
              <Pressable onPress={() => setReplyTo(item.comment)} style={{ marginTop: space.sm }}>
                <Text style={[type.caption, { color: colors.accent }]}>답글</Text>
              </Pressable>
            )}
          </View>
        )}
        contentContainerStyle={{ paddingBottom: space.lg }}
      />

      {/* 댓글 입력 */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {replyTo && (
          <View style={s.replyBar}>
            <Text style={type.caption}>{labels[replyTo.authorId]}에게 답글 중</Text>
            <Pressable onPress={() => setReplyTo(null)}><Text style={[type.caption, { color: colors.accent }]}>취소</Text></Pressable>
          </View>
        )}
        <View style={s.inputBar}>
          <Pressable onPress={() => setAnon((v) => !v)} style={[s.anonBtn, anon && s.anonOn]}>
            <Text style={[type.caption, anon && { color: '#fff' }]}>익명</Text>
          </Pressable>
          <TextInput
            style={s.input} placeholder="댓글 달기…" placeholderTextColor={colors.inkSub}
            value={body} onChangeText={setBody} multiline
          />
          <Pressable onPress={submit} disabled={!body.trim()}>
            <Text style={[type.body, { color: body.trim() ? colors.accent : colors.inkSub, fontWeight: '700' }]}>등록</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  postBox: { ...card, marginTop: space.md },
  rowC: { flexDirection: 'row', alignItems: 'center' },
  tag: { backgroundColor: colors.bg, borderRadius: radius.chip, paddingHorizontal: space.sm, paddingVertical: 2 },
  comment: { paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomColor: colors.line, borderBottomWidth: 1 },
  reply: { paddingLeft: space.xl + space.md, backgroundColor: '#FFFDF4' },
  author: { ...type.caption, fontWeight: '700', color: colors.ink },
  replyBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.bg,
    borderTopColor: colors.line, borderTopWidth: 1,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1,
  },
  anonBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: 6 },
  anonOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  input: { ...type.body, flex: 1, maxHeight: 100, backgroundColor: colors.bg, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: space.sm },
});
