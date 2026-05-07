import { PageHeader } from "@/components/layout/page-header";
import { InDevelopmentNotice } from "@/components/layout/in-development-notice";

export default function BloodworkPage() {
  return (
    <>
      <PageHeader
        eyebrow="Lab Panels"
        title="Bloodwork"
        description="ASCVD risk, hormonal, metabolic, inflammation, genetics, and microbiome markers."
      />
      <InDevelopmentNotice
        title="Lab integration in development"
        description="Secure ingestion of your LabCorp and Quest results is actively being built. In the meantime, your coach reviews every panel with you directly and tracks your progress across all six biomarker categories."
        expectedRelease="Coming soon"
      />
    </>
  );
}
