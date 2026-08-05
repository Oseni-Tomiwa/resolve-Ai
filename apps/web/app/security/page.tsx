import { LegalPage } from '../legal/legal-page';

export default function Page() {
  return (
    <LegalPage
      title="Security"
      eyebrow="Security practices"
      intro="A concise overview of the controls that should be verified before launch."
      sections={[
        {
          heading: 'Access control',
          body: 'Workspace authorization and role permissions are enforced server-side, with tenant-scoped queries and protected dashboard routes.',
        },
        {
          heading: 'Secrets',
          body: 'Backend secrets must be injected through the deployment secret manager and must never be exposed to browser bundles or committed to Git.',
        },
        {
          heading: 'Data protection',
          body: 'Production should use private PostgreSQL, Redis, object storage, TLS, backups, restricted network access, and tested recovery procedures.',
        },
        {
          heading: 'Report an issue',
          body: 'Send vulnerability reports to the configured security contact. Do not include live credentials or customer data in a report.',
        },
      ]}
    />
  );
}
