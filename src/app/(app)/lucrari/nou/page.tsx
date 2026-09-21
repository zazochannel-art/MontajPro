"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { JobForm } from "@/components/jobs/job-form";
import { Skeleton } from "@/components/ui/skeleton";

function NewJobForm() {
  // Venind din pagina unui proiect, lucrarea se naște direct sub el.
  const projectId = useSearchParams().get("proiect");
  return <JobForm projectId={projectId} />;
}

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Lucrare nouă"
        description="Completează ce știi acum — restul se poate adăuga pe parcurs."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <NewJobForm />
      </Suspense>
    </div>
  );
}
