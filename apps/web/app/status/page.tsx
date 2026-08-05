import { LegalPage } from '../legal/legal-page';

export default function Page() {
  return (
    <LegalPage
      title="System status"
      eyebrow="ResolveAI status"
      intro="A placeholder status surface for the production status provider."
      sections={[
        {
          heading: 'Current state',
          body: 'No live status provider is configured in this repository. This page intentionally does not claim service availability.',
        },
        {
          heading: 'Incident updates',
          body: 'Configure a status provider and link it from this page before launch. Use request IDs and timestamps when correlating an incident.',
        },
        {
          heading: 'Support',
          body: 'For workspace-specific issues, contact support with a safe diagnostic summary.',
        },
      ]}
    />
  );
}
