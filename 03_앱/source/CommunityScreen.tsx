// screens/CommunityScreen.tsx — 커뮤니티 탭 (core-spec §2)
import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme/tokens';
import { useSession } from '../context/SessionContext';
import { fetchPosts, createPost, type Post, type Tag } from '../lib/community';
import TagFilterBar from '../components/community/TagFilterBar';
import PostCard from '../components/community/PostCard';
import PostComposer from '../components/community/PostComposer';

export default function CommunityScreen() {
  const { school, user } = useSession();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [tag, setTag] = React.useState<Tag | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [composing, setComposing] = React.useState(false);

  const load = React.useCallback(async () => {
    const list = await fetchPosts(school, tag ?? undefined);
    setPosts(list);
  }, [school, tag]);

  React.useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const like = (id: string) => setPosts((ps) => ps.map((p) =>
    p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p));
  const scrap = (id: string) => setPosts((ps) => ps.map((p) =>
    p.id === id ? { ...p, scrapped: !p.scrapped } : p));

  const submit = async (v: { tag: Tag; body: string; isAnonymous: boolean }) => {
    const post = await createPost({
      ...v, nickname: user.nickname, isGraduate: user.isGraduate,
    });
    // 현재 태그 필터에 맞으면 목록 상단에 추가
    if (!tag || tag === post.tag) setPosts((ps) => [post, ...ps]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={type.title}>{school.school_name}</Text>
        <Text style={type.caption}>우리 학교 사람들만 볼 수 있어요</Text>
      </View>

      <TagFilterBar active={tag} onChange={setTag} />

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} onLike={like} onScrap={scrap} />}
        contentContainerStyle={{ paddingVertical: space.sm, paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        ListEmptyComponent={
          <Text style={s.empty}>
            {loading ? '' : '아직 짜낸 소식이 없어요.\n첫 글을 남겨보세요!'}
          </Text>
        }
      />

      {/* 글쓰기 FAB */}
      <Pressable style={s.fab} onPress={() => setComposing(true)}>
        <Text style={s.fabTxt}>＋</Text>
      </Pressable>

      <PostComposer visible={composing} onClose={() => setComposing(false)} onSubmit={submit} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.lg, paddingTop: space.md },
  empty: { ...type.body, color: colors.inkSub, textAlign: 'center', marginTop: space.xl * 2, lineHeight: 22 },
  fab: {
    position: 'absolute', right: space.lg, bottom: space.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  fabTxt: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '300' },
});
