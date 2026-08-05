import { LegalPage } from '../legal/legal-page';

export default function Page() {
  return (
    <LegalPage
      title="Privacy"
      eyebrow="Privacy & data"
      intro="How ResolveAI is intended to handle customer and workspace data."
      sections={[
        {
          heading: 'Data we process',
          body: 'ResolveAI processes account details, workspace membership data, support conversations, uploaded knowledge documents, and service telemetry required to operate the product.',
        },
        {
          heading: 'How data is used',
          body: 'Data is used to authenticate users, provide workspace-scoped support features, process knowledge sources, deliver AI responses, and improve reliability and security.',
        },
        {
          heading: 'Retention and deletion',
          body: 'Production retention periods, deletion workflows, subprocessors, and data-subject rights must be finalized for the launch jurisdiction and documented here before launch.',
        },
        {
          heading: 'Contact',
          body: 'For privacy questions, contact the configured privacy contact for your organization.',
        },
      ]}
    />
  );
}
