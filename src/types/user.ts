/** The signed-in person as the screens see them, so no Firebase types leak into the UI. */
export interface AppUser {
  uid: string;
  email: string | null;
  /** True for the development-only demo account (see src/lib/demoAccount.ts). */
  isDemo: boolean;
}
