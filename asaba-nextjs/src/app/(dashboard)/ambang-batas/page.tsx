import { Suspense } from "react";
import { HalamanAmbangBatas } from "@/components/ambang-batas";

export default function AmbangBatasPage() {
  // Suspense wajib karena halamannya membaca ?site= lewat useSearchParams.
  return (
    <Suspense fallback={null}>
      <HalamanAmbangBatas />
    </Suspense>
  );
}
