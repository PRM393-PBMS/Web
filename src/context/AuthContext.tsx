import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authService, type RegisterRequest } from "../utils/authService";
import { profileApi } from "../utils/apiServices";
import { normalizeLicensePlate } from "../utils/licensePlate";
import type { UserProfile } from "../types/profile";

export type UserRole =
  | "guest"
  | "user"
  | "customer"
  | "staff"
  | "manager"
  | "admin";

export interface AuthUser {
  userId?: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
}

export interface RegisterResult {
  ok: boolean;
  message: string;
  authenticated?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    userName: string,
    fullName: string,
    email: string,
    phoneNumber: string,
    password: string,
    confirmPassword: string,
  ) => Promise<RegisterResult>;
  verifyRegisterOtp: (
    email: string,
    otp: string,
    password: string,
  ) => Promise<RegisterResult>;
  updateProfile: (data: Partial<UserProfile>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  upgradeToCustomer: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Default user for demo
export const DEMO_USER: AuthUser = {
  email: "user@easyparking.vn",
  name: "Nguyễn Văn A",
  role: "staff",
};

function profileKey(email: string) {
  return `pbms_profile_${email}`;
}

function loadProfile(email: string, name: string): UserProfile {
  const saved = localStorage.getItem(profileKey(email));
  if (saved) {
    const profile = JSON.parse(saved) as UserProfile;
    return {
      ...profile,
      vehiclePlate: normalizeLicensePlate(profile.vehiclePlate),
    };
  }
  return {
    email,
    name,
    phone: "",
    vehiclePlate: "51A12345",
    address: "",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const storedUser = authService.getStoredUser();
    return (storedUser as AuthUser | null) ?? DEMO_USER;
  });

  const [profile, setProfile] = useState<UserProfile | null>(() =>
    user ? loadProfile(user.email, user.name) : null,
  );

  const [isLoading, setIsLoading] = useState(false);

  const persistUser = useCallback((authUser: AuthUser) => {
    setUser(authUser);
    setProfile(loadProfile(authUser.email, authUser.name));
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      if (!email.trim() || !password.trim()) return false;

      setIsLoading(true);
      try {
        const response = await authService.login({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        });

        if (response.isSuccess && response.result) {
          const { user: backendUser } = response.result;
          persistUser({
            userId: backendUser.userId,
            email: backendUser.email,
            name: backendUser.fullName,
            phone: backendUser.phoneNumber,
            role: (backendUser.roleName.toLowerCase() as UserRole) || "user",
          });
          return true;
        }

        return false;
      } catch (error) {
        console.error("Login error:", error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [persistUser],
  );

  const register = useCallback(
    async (
      userName: string,
      fullName: string,
      email: string,
      phoneNumber: string,
      password: string,
      confirmPassword: string,
    ): Promise<RegisterResult> => {
      const trimmedUserName = userName.trim();
      const trimmedName = fullName.trim();
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPhone = phoneNumber.trim();

      if (!trimmedUserName)
        return { ok: false, message: "Vui lòng nhập tên đăng nhập." };
      if (!trimmedName)
        return { ok: false, message: "Vui lòng nhập họ và tên." };
      if (!trimmedEmail) return { ok: false, message: "Vui lòng nhập email." };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return { ok: false, message: "Email không hợp lệ." };
      }
      if (!trimmedPhone)
        return { ok: false, message: "Vui lòng nhập số điện thoại." };
      if (!/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(trimmedPhone)) {
        return {
          ok: false,
          message: "Số điện thoại phải là số di động Việt Nam hợp lệ.",
        };
      }
      if (password.length < 6)
        return { ok: false, message: "Mật khẩu phải có ít nhất 6 ký tự." };
      if (password !== confirmPassword) {
        return { ok: false, message: "Mật khẩu xác nhận không khớp." };
      }

      setIsLoading(true);
      try {
        const registerData: RegisterRequest = {
          userName: trimmedUserName,
          fullName: trimmedName,
          email: trimmedEmail,
          phoneNumber: trimmedPhone,
          password,
          confirmPassword,
        };

        const response = await authService.sendRegisterOtp(registerData);

        if (response.isSuccess) {
          return {
            ok: true,
            message:
              response.message || "Mã OTP đã được gửi đến email của bạn.",
          };
        }

        return { ok: false, message: response.message || "Đăng ký thất bại." };
      } catch (error) {
        console.error("Register error:", error);
        return { ok: false, message: "Lỗi đăng ký. Vui lòng thử lại." };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const verifyRegisterOtp = useCallback(
    async (
      email: string,
      otp: string,
      password: string,
    ): Promise<RegisterResult> => {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedOtp = otp.trim();
      if (!/^\d{6}$/.test(trimmedOtp)) {
        return { ok: false, message: "Mã OTP phải gồm đúng 6 chữ số." };
      }

      setIsLoading(true);
      try {
        const response = await authService.verifyRegisterOtp({
          email: trimmedEmail,
          otp: trimmedOtp,
        });
        if (!response.isSuccess) {
          return {
            ok: false,
            message: response.message || "Xác thực OTP thất bại.",
          };
        }

        const loginResponse = await authService.login({
          email: trimmedEmail,
          password,
        });
        if (loginResponse.isSuccess && loginResponse.result) {
          const { user: backendUser } = loginResponse.result;
          persistUser({
            userId: backendUser.userId,
            email: backendUser.email,
            name: backendUser.fullName,
            phone: backendUser.phoneNumber,
            role: (backendUser.roleName.toLowerCase() as UserRole) || "user",
          });
          return {
            ok: true,
            authenticated: true,
            message: "Đăng ký thành công.",
          };
        }

        return {
          ok: true,
          authenticated: false,
          message: "Đăng ký thành công. Vui lòng đăng nhập.",
        };
      } catch (error) {
        console.error("Verify register OTP error:", error);
        return {
          ok: false,
          message: "Không thể xác thực OTP. Vui lòng thử lại.",
        };
      } finally {
        setIsLoading(false);
      }
    },
    [persistUser],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const res = await profileApi.get();
      if (res.isSuccess && res.result) {
        const u = res.result;
        setProfile((prev) => {
          const nextProfile = {
            email: u.email,
            name: u.fullName,
            phone: u.phoneNumber ?? "",
            vehiclePlate: normalizeLicensePlate(prev?.vehiclePlate ?? ""),
            address: prev?.address ?? "",
          };
          localStorage.setItem(
            profileKey(u.email),
            JSON.stringify(nextProfile),
          );
          return nextProfile;
        });
        setUser((prev) =>
          prev
            ? {
                ...prev,
                userId: u.userId,
                name: u.fullName,
                phone: u.phoneNumber,
                role: (u.roleName.toLowerCase() as UserRole) || prev.role,
              }
            : prev,
        );
        sessionStorage.setItem("user_name", u.fullName);
        sessionStorage.setItem("user_role", u.roleName);
        sessionStorage.setItem("user_phone", u.phoneNumber ?? "");
        if (u.userId) sessionStorage.setItem("user_id", u.userId);
      }
    } catch (error) {
      console.error("Refresh profile error:", error);
    }
  }, [user]);

  const updateProfile = useCallback(
    async (data: Partial<UserProfile>): Promise<boolean> => {
      if (!user) return false;
      try {
        const res = await profileApi.update({
          fullName: data.name,
          phoneNumber: data.phone,
        });
        if (res.isSuccess && res.result) {
          const u = res.result;
          const nextProfile = {
            email: u.email || user.email,
            name: u.fullName,
            phone: u.phoneNumber ?? "",
            vehiclePlate: normalizeLicensePlate(
              data.vehiclePlate ?? profile?.vehiclePlate ?? "",
            ),
            address: data.address ?? profile?.address ?? "",
          };
          setProfile(nextProfile);
          setUser((prev) =>
            prev ? { ...prev, name: u.fullName, phone: u.phoneNumber } : prev,
          );
          localStorage.setItem(
            profileKey(nextProfile.email),
            JSON.stringify(nextProfile),
          );
          sessionStorage.setItem("user_name", u.fullName);
          sessionStorage.setItem("user_phone", u.phoneNumber ?? "");
          return true;
        }
        return false;
      } catch (error) {
        console.error("Update profile error:", error);
        return false;
      }
    },
    [user, profile],
  );

  const upgradeToCustomer = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const nextUser = { ...prev, role: "customer" as UserRole };
      sessionStorage.setItem("user_role", "customer");
      return nextUser;
    });
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      verifyRegisterOtp,
      updateProfile,
      refreshProfile,
      upgradeToCustomer,
      logout,
    }),
    [
      user,
      profile,
      isLoading,
      login,
      register,
      verifyRegisterOtp,
      updateProfile,
      refreshProfile,
      upgradeToCustomer,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
