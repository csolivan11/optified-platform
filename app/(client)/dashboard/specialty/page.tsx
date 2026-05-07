import { PageHeader } from "@/components/layout/page-header";
import { InDevelopmentNotice } from "@/components/layout/in-development-notice";

export default function SpecialtyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Diagnostic Imaging & Testing"
        title="Specialty Testing"
        description="CAC scores, DEXA body composition, colonoscopy, MRI, and other diagnostic results."
      />
      <InDevelopmentNotice
        title="Secure document vault in development"
        description="The capability to upload, store, and visualize your specialty testing results is being built with end-to-end encryption and full audit logging. Your coach has access to all current results and walks through findings with you in every review."
        expectedRelease="Coming soon"
      />
    </>
  );
}
