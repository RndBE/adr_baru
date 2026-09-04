"use client";

import { useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fontDisplay } from "@/lib/fonts";
import { cn } from "@/lib/utils";

const TAHUN = new Date().getFullYear();

/** Judul + garis ukur. Dipakai dua kali: di lembar survei (layar lebar) dan di
 *  atas kartu form (layar sempit, tempat lembar itu disembunyikan). */
function JudulLembar({ ringkas = false }: { ringkas?: boolean }) {
  return (
    <div>
      {/* Garis ukur mengukur bentang judul, jadi keduanya berbagi satu
          pembatas lebar. Paragraf punya ukurannya sendiri. */}
      <div className="w-fit">
        <h1
          className={cn(
            "font-display font-bold tracking-[-0.02em] text-(--ink)",
            ringkas
              ? "text-[clamp(1.9rem,9vw,2.5rem)] leading-[0.98]"
              : "text-[clamp(2.5rem,4.2vw,4rem)] leading-[0.94]"
          )}
        >
          {/* Baris dipatahkan manual supaya bentang judul tetap sama di semua
              lebar — garis ukur di bawahnya mengukur bentang itu. */}
          Precision
          <br />
          Deformation
          <br />
          Monitoring
        </h1>
        <span aria-hidden className="garis-ukur mt-5" />
      </div>
      <p
        className={cn(
          "text-(--ink-2)",
          ringkas
            ? "mt-4 max-w-[38ch] text-[15px] leading-6"
            : "mt-5 max-w-[40ch] text-[17px] leading-7"
        )}
      >
        Pantau perubahan struktur secara presisi, real-time, dan terukur.
      </p>
    </div>
  );
}

function KakiMerek({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-6", className)}>
      <div className="flex items-center gap-5">
        <img
          src="/logo_be.png"
          alt="Beacon Engineering"
          style={{ width: 76, height: 28 }}
          className="object-contain"
        />
        <img
          src="/logostesy.png"
          alt="STESY"
          style={{ width: 86, height: 28 }}
          className="object-contain"
        />
      </div>
      <p className="text-[12px] text-(--ink-3)">© Beacon Engineering {TAHUN}</p>
    </div>
  );
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [capsLock, setCapsLock] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Sebutan field dan sebutan galat harus sama: "Nama Pengguna".
        setError("Nama pengguna atau kata sandi salah.");
      } else if (result?.ok) {
        // Redirect relatif supaya ikut host / IP mana pun.
        window.location.replace("/beranda");
      } else {
        setError("Tidak bisa masuk. Coba lagi.");
      }
    } catch {
      setError("Sambungan ke server gagal. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  /* Kolom isian duduk sedikit lebih dalam dari kartunya (kertas di atas putih),
     lalu naik jadi putih saat difokus — jadi field aktif punya penanda selain
     garis tepi. */
  const kolomInput =
    "h-12 rounded-[10px] border-(--line) bg-(--paper) px-3.5 text-[15px] text-(--ink) shadow-none transition-colors placeholder:text-(--ink-3)/75 focus-visible:border-(--navy) focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-(--navy)/20";
  const labelForm = "text-[13px] font-semibold text-(--ink-2)";

  return (
    <div
      className={cn(
        "tema-monitoring halaman-masuk flex min-h-screen bg-(--paper) text-(--ink) lg:h-screen lg:min-h-0 lg:overflow-hidden",
        fontDisplay.variable
      )}
    >
      {/* ── Lembar survei ───────────────────────────────────────────────────
          Kisi, rel tik di tepi, dan ilustrasi instrumen di tengahnya. */}
      <section className="lembar-survei hidden flex-col bg-white px-14 py-10 lg:flex lg:w-[56%] xl:px-20 xl:py-12 2xl:w-[58%]">
        <JudulLembar />

        <div className="flex min-h-0 flex-1 items-center justify-center py-6">
          <img
            src="/logo_login.svg"
            alt="Total station membidik prisma pantau, dengan dasbor pemantauan di layar"
            className="max-h-full w-auto max-w-[640px] object-contain"
          />
        </div>

        <KakiMerek className="justify-between border-t border-(--line) pt-5" />
      </section>

      {/* ── Kartu masuk ─────────────────────────────────────────────────────
          Berdiri di atas kertas, bukan menempel di tepi layar: form punya
          batas yang jelas dan bayangannya bernada navy, senada aplikasi. */}
      <main className="flex w-full flex-col justify-center px-5 py-10 sm:px-8 lg:w-[44%] lg:px-10 xl:px-14 2xl:w-[42%]">
        <div className="mx-auto mb-8 w-full max-w-[440px] lg:hidden">
          <JudulLembar ringkas />
        </div>

        <div className="mx-auto w-full max-w-[440px] rounded-[18px] bg-white p-8 ring-1 ring-(--line) shadow-[0_2px_6px_-2px_oklch(0.235_0.07_278/0.12),0_26px_50px_-30px_oklch(0.235_0.07_278/0.45)] sm:p-9">
          {/* Pelat nama: siapa yang diajak masuk, dipisah garis dari kendalinya. */}
          <div className="-mx-8 border-b border-(--line) px-8 pb-5 sm:-mx-9 sm:px-9">
            <h2 className="font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-(--ink) sm:text-[28px]">
              Masuk ke akun Anda
            </h2>
            <p className="mt-1.5 text-[14px] text-(--ink-3)">
              Masukkan nama pengguna dan kata sandi Anda.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2.5 rounded-[10px] border border-(--signal)/25 bg-(--signal)/6 px-3.5 py-2.5 text-[13px] leading-5 text-(--ink)"
              >
                <AlertCircle
                  aria-hidden
                  className="mt-px size-4 shrink-0 text-(--signal)"
                />
                {error}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className={labelForm}>
                Nama Pengguna
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Nama pengguna Anda"
                className={kolomInput}
                autoComplete="username"
                aria-invalid={!!error}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className={labelForm}>
                Kata Sandi
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Kata sandi Anda"
                  className={cn(kolomInput, "pr-12")}
                  autoComplete="current-password"
                  aria-invalid={!!error}
                  aria-describedby={capsLock ? "caps-lock" : undefined}
                  onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                  onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                  onBlur={() => setCapsLock(false)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-(--ink-3) transition-colors hover:bg-(--ink)/5 hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--navy)/35"
                  aria-label={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-[18px]" />
                  ) : (
                    <Eye className="size-[18px]" />
                  )}
                </button>
              </div>
              {capsLock && (
                <p
                  id="caps-lock"
                  className="flex items-center gap-1.5 text-[12.5px] text-(--ink-2)"
                >
                  <AlertCircle aria-hidden className="size-3.5 text-(--signal)" />
                  Caps Lock sedang aktif.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 pt-1">
              {/* Sakelar, bukan kotak centang: "Ingat saya" adalah setelan yang
                  menyala atau mati, dan keadaannya harus terbaca sekilas. */}
              <label
                htmlFor="remember"
                className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-(--ink-2) select-none"
              >
                <span className="relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full bg-(--ink-3)/30 p-[3px] transition-colors has-[:checked]:bg-(--navy) has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-(--navy)/35 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-white">
                  <input type="checkbox" id="remember" className="peer sr-only" />
                  <span className="size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(20,23,58,0.35)] transition-transform duration-200 ease-out peer-checked:translate-x-4" />
                </span>
                Ingat saya
              </label>
              <a
                href="#"
                className="rounded-[4px] text-[13px] font-semibold text-(--navy) underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-(--navy)/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                Lupa kata sandi?
              </a>
            </div>

            {/* Gradien tombol sama dengan menu aktif di sidebar — begitu masuk,
                warna yang sama menyambut di sana. */}
            <Button
              type="submit"
              className="mt-3 h-12 w-full cursor-pointer rounded-[10px] bg-[image:linear-gradient(135deg,oklch(0.47_0.14_278),oklch(0.37_0.11_278))] text-[15px] font-semibold text-white shadow-[0_10px_22px_-12px_oklch(0.37_0.11_278/0.9)] transition-[filter,box-shadow] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-(--navy)/35 disabled:opacity-70"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Sedang masuk…
                </span>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>
        </div>

        <KakiMerek className="mx-auto mt-8 w-full max-w-[440px] flex-col items-center gap-3 lg:hidden" />
      </main>
    </div>
  );
}
