import { LegalPage } from '../legal/legal-page';

export default function Page() {
  return (
    <LegalPage
      title="Terms of service"
      eyebrow="Terms"
      intro="The operating terms for using ResolveAI workspaces and support tools."
      sections={[
        {
          heading: 'Using the service',
          body: 'Customers are responsible for authorized use of their workspace, accurate account information, and protecting credentials and invitations.',
        },
        {
          heading: 'Customer content',
          body: 'Customers retain responsibility for content uploaded to ResolveAI and must have the rights and permissions needed to process it.',
        },
        {
          heading: 'Availability and changes',
          body: 'The service may change as reliability and security improvements are released. Contractual availability commitments should be added here before launch.',
        },
        {
          heading: 'Contact',
          body: 'For contractual questions, contact the configured support or legal contact.',
        },
      ]}
    />
  );
}
