// theme/tokens.ts — catchup-ui-spec-v1 §1 구현
// 원칙: 배경은 아이보리, 구조는 무채색, 색은 주홍에만. 골드는 관리자 채팅 전용.

export const colors = {
  bg: '#FFFFF0',        // 아이보리 (255/255/240)
  surface: '#FFFFFF',
  accent: '#F57E4E',    // 주홍 (245/126/78)
  accentDeep: '#E4652F',
  admin: '#D9A441',     // 골드 (관리자 채팅 전용)
  ink: '#2A2622',
  inkSub: '#6E655C',
  line: '#EFE7D6',
  danger: '#D64545',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { card: 16, button: 12, chip: 999 } as const;

export const type = {
  display: { fontSize: 28, fontWeight: '800' as const, color: colors.ink },
  title: { fontSize: 17, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.ink },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.inkSub },
} as const;

export const card = {
  backgroundColor: colors.surface,
  borderRadius: radius.card,
  borderWidth: 1,
  borderColor: colors.line,
  padding: space.lg,
  marginHorizontal: space.lg,
  marginBottom: space.md,
  // 인스타식 부드러운 그림자
  shadowColor: '#000',
  shadowOpacity: 0.04,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
} as const;
