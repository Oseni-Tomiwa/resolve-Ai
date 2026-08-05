import { LegalPage } from '../legal/legal-page';

export default function Page() {
  return (
    <LegalPage
      title="Support"
      eyebrow="We are here to help"
      intro="Get help with your ResolveAI workspace and launch setup."
      sections={[
        {
          heading: 'Product support',
          body: 'Contact your configured support address with the workspace, request ID, route, timestamp, and a safe description of the issue. Never send passwords, tokens, API keys, or document contents.',
        },
        {
          heading: 'Urgent security issues',
          body: 'Use the security contact for suspected account compromise, data exposure, or vulnerabilities.',
        },
        {
          heading: 'Service status',
          body: 'A customer-facing status provider should be linked here once configured for production.',
        },
      ]}
    />
  );
}
