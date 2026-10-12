import { DetailSkeleton } from "@/components/DetailSkeleton";

export default function DetailLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <DetailSkeleton />
    </main>
  );
}
