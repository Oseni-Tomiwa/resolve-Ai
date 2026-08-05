import { LegalPage } from '../legal/legal-page';

export default function Page() {
  return (
    <LegalPage
      title="Acceptable use"
      eyebrow="Trust & safety"
      intro="Guardrails for responsible use of ResolveAI."
      sections={[
        {
          heading: 'Prohibited activity',
          body: 'Do not use ResolveAI for unlawful activity, credential theft, harassment, malicious automation, or attempts to bypass access controls.',
        },
        {
          heading: 'Sensitive content',
          body: 'Do not upload regulated or sensitive data unless your agreement, configuration, and applicable law permit it.',
        },
        {
          heading: 'Abuse reporting',
          body: 'Report suspected abuse or security concerns through the configured support and security contacts.',
        },
        {
          heading: 'Enforcement',
          body: 'ResolveAI may restrict access when necessary to protect users, data, infrastructure, or the public.',
        },
      ]}
    />
  );
}
