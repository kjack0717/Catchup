// context/SessionContext.tsx
// 인증 게이트: verified=false 면 온보딩(학생증 인증)만 보이고,
// completeVerification() 이 호출되면 실제 학교/사용자가 세션에 주입되며 앱이 열린다.

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { School } from '../lib/neis';

export type SessionUser = {
  id: string;
  nickname: string;      // 실명(본명) 표기용
  isGraduate?: boolean;
  gradClass?: number;
};

export type Session = {
  verified: boolean;
  school: School;
  user: SessionUser;
  unreadDM: number;
};

type SessionApi = Session & {
  completeVerification: (school: School, nickname: string) => void;
  resetSession: () => void; // 데모용: 인증 다시 해보기
};

// 인증 전 기본값 (verified=false → 온보딩 표시)
const INITIAL: Session = {
  verified: false,
  school: { school_code: '', office_code: '', school_name: '', grade: undefined },
  user: { id: '', nickname: '' },
  unreadDM: 0,
};

const Ctx = createContext<SessionApi>({
  ...INITIAL,
  completeVerification: () => {},
  resetSession: () => {},
});

export const useSession = () => useContext(Ctx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(INITIAL);

  const completeVerification = useCallback((school: School, nickname: string) => {
    setSession({
      verified: true,
      school,
      user: { id: `u_${school.school_code}_${Date.now()}`, nickname },
      unreadDM: 2, // 데모: 관리자 환영 쪽지 등
    });
  }, []);

  const resetSession = useCallback(() => setSession(INITIAL), []);

  return (
    <Ctx.Provider value={{ ...session, completeVerification, resetSession }}>
      {children}
    </Ctx.Provider>
  );
}
