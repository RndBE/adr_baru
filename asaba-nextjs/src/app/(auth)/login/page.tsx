"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
        setError("Username atau kata sandi salah");
      } else if (result?.ok) {
        // Use relative redirect so it works on any host / IP
        window.location.replace("/beranda");
      } else {
        setError("Login gagal, coba lagi");
      }
    } catch {
      setError("Terjadi kesalahan, coba lagi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* LEFT PANEL - Illustration & Welcome Text */}
      <div className="hidden lg:flex w-[65%] flex-col justify-center px-16 xl:px-24 relative overflow-hidden">
        <div className="relative z-10 space-y-4 max-w-[600px] mb-12">
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-[#303481] whitespace-nowrap">
            <span className="italic relative inline-block">
              Precision
              <span className="absolute bottom-1 left-0 w-full h-[4px] bg-[#E32636]"></span>
            </span>{" "}
            Deformation Monitoring
          </h1>
          <p className="text-xl text-gray-800 whitespace-nowrap">
            Pantau perubahan struktur secara{" "}
            <span className="bg-[#FFE5B4] px-1 font-semibold rounded-md">presisi</span>,{" "}
            <span className="bg-[#FFE5B4] px-1 font-semibold rounded-md">real-time</span>, dan{" "}
            <span className="bg-[#FFE5B4] px-1 font-semibold rounded-md">terukur</span>.
          </p>
        </div>

        <div className="relative z-10 w-full max-w-[600px] mx-auto aspect-square flex items-center justify-center">
          {/* We use the generated illustration or you can swap with the real SVG later */}
          <img
            src="/logo_login.svg" 
            alt="Monitoring Illustration"
            className="w-full h-full object-contain"
          />
        </div>
        
        {/* Copyright */}
        <div className="absolute bottom-8 left-16 xl:left-24">
          <p className="text-sm font-medium text-[#303481]">
            © Beacon Engineering {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* RIGHT PANEL - Login Form */}
      <div className="w-full lg:w-[35%] flex flex-col justify-center bg-[#F3F4F6] relative">
        <div className="w-full px-6 sm:px-12 lg:px-16 xl:px-20">
          
          <div className="mb-10 text-left">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Masuk ke Akun Anda</h2>
            <p className="text-gray-500 text-sm">
              Masukkan detail akun Anda untuk melanjutkan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-[13px] font-bold text-gray-700">
                Nama Pengguna
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Masukkan nama pengguna"
                className="h-12 bg-white border-white focus-visible:ring-1 focus-visible:ring-[#303481] shadow-sm text-sm"
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[13px] font-bold text-gray-700">
                  Kata Sandi
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan kata sandi"
                    className="h-12 bg-white border-white focus-visible:ring-1 focus-visible:ring-[#303481] shadow-sm text-sm"
                    autoComplete="off"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-900 hover:text-gray-600 focus:outline-none"
                    title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="h-4 w-4 rounded border-gray-300 text-[#303481] focus:ring-[#303481]"
                  />
                  <label htmlFor="remember" className="text-[13px] font-medium text-gray-700 cursor-pointer">
                    Ingat Saya
                  </label>
                </div>
                <a href="#" className="text-[13px] font-bold text-[#303481] hover:underline">
                  Lupa Kata Sandi?
                </a>
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full bg-[#303481] hover:bg-[#252865] text-white font-bold text-[15px] rounded-lg transition-all shadow-md mt-4 cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Sedang Masuk...</span>
                </div>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>

        </div>

        {/* Footer Logos */}
        <div className="absolute bottom-8 left-0 w-full flex flex-col items-center justify-center gap-3">
          <div className="flex items-center justify-center gap-4">
            <img src="/logo_be.png" alt="Beacon Engineering" style={{ width: 80, height: 30 }} className="object-contain" />
            <img src="/logostesy.png" alt="STESY" style={{ width: 90, height: 30 }} className="object-contain" />
          </div>
          <p className="text-[11px] font-bold text-gray-500">
            © Beacon Engineering {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
