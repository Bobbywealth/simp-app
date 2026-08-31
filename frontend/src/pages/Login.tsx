import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { SimpLogo } from "../components/SimpLogo";
import AppleSignInButton, {
  type AppleCredential,
} from "../components/AppleSignInButton";
import { appleSignIn, login, me } from "../api/auth";
import { useAuth } from "../store/auth";

type FormValues = { email: string; password: string };
const LAST_EMAIL_KEY = "simp_last_login_email";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      email: localStorage.getItem(LAST_EMAIL_KEY) ?? "",
      password: "",
    },
  });

  useEffect(() => {
    const saved = localStorage.getItem(LAST_EMAIL_KEY);
    if (saved) setValue("email", saved);
  }, [setValue]);

  const onSubmit = async (data: FormValues) => {
    localStorage.setItem(LAST_EMAIL_KEY, data.email);
    setError(null);
    setSubmitting(true);
    try {
      await login(data);
      const meData = await me();
      setUser(meData);
      if (!meData.emailVerified)
        navigate("/verify-email-pending", { replace: true });
      else if (!meData.profile || !meData.onboardingCompletedAt)
        navigate("/profile-setup", { replace: true });
      else navigate("/home", { replace: true });
    } catch (e) {
      setError((e as Error).message || "Log in failed");
    } finally {
      setSubmitting(false);
    }
  };
  const handleAppleSuccess = async (cred: AppleCredential) => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await appleSignIn({
        identityToken: cred.identityToken,
        fullName: cred.fullName,
        firstName: cred.firstName,
        lastName: cred.lastName,
        email: cred.email,
        rawUser: cred.rawUser,
      });
      const meData = await me();
      setUser(meData);
      if (result.isNewUser || !meData.profile || !meData.onboardingCompletedAt)
        navigate("/profile-setup", { replace: true });
      else if (!meData.emailVerified)
        navigate("/verify-email-pending", { replace: true });
      else navigate("/home", { replace: true });
    } catch (e) {
      setError((e as Error).message || "Apple sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };
  const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID;
  const showApple = Boolean(appleClientId);
  const appleClientIdValue = appleClientId ?? "";

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-black text-white">
      <img
        src="/editorial/welcome.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/45" />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-6 pb-safe pt-safe">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="pt-6"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/65 hover:text-white"
          >
            <SimpLogo size={36} variant="emblem" /> SIMP
          </Link>
          <div className="mt-12 max-w-xs">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gold-200">
              Your private room
            </p>
            <h1 className="display-heading mt-3 text-4xl font-light">
              Welcome back.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Continue the conversations that feel like something.
            </p>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="my-8 rounded-[1.75rem] border border-white/15 bg-black/55 p-5 shadow-2xl backdrop-blur-xl"
        >
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email", { required: "Email is required" })}
              error={errors.email?.message}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="********"
              {...register("password", { required: "Password is required" })}
              error={errors.password?.message}
            />
            {error && (
              <p className="text-xs text-red-400" role="alert">
                {error}
              </p>
            )}
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-xs text-gold-200 hover:text-gold-100"
              >
                Forgot password?
              </Link>
            </div>
            <Button type="submit" loading={submitting} className="mt-2">
              Log in
            </Button>
          </form>
          {showApple && (
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  or
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="mt-4">
                <AppleSignInButton
                  clientId={appleClientIdValue}
                  mode="sign-in"
                  onSuccess={handleAppleSuccess}
                  onError={(e) =>
                    setError((e as Error)?.message ?? "Apple sign-in failed")
                  }
                  disabled={submitting}
                />
              </div>
            </div>
          )}
        </motion.div>
        <div className="pb-6 text-center text-sm text-white/60">
          New here?{" "}
          <Link to="/signup" className="text-gold-200 hover:text-gold-100">
            Create an account
          </Link>
        </div>
        {import.meta.env.DEV && (
          <div className="mb-5 rounded-2xl border border-dashed border-white/15 bg-black/45 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Test login
            </p>
            <p className="mt-2 text-xs text-white/60">
              Want to poke around? Use the seeded test user:
            </p>
            <button
              type="button"
              onClick={() => {
                setValue("email", "kenji@simp-seed.demo");
                setValue("password", "Demo123!");
              }}
              className="mt-3 w-full rounded-full border border-gold-400/30 bg-gold-400/10 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-200 hover:bg-gold-400/20"
            >
              Use Kenji (test user)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
