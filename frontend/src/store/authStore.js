import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      accessToken: null,
      user: null,

      loginSuccess: ({ access, user }) => {
        set({ accessToken: access, user });
      },
      setAccessToken: (access) => set({ accessToken: access }),
      setUser: (user) => set({ user }),
      logout: () => {
        set({ accessToken: null, user: null });
      },
    }),
    {
      name: 'jornalpro-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    }
  )
);
