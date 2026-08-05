import { LegalPage } from '../legal/legal-page';

export default function Page() {
  return (
    <LegalPage
      title="Cookie notice"
      eyebrow="Privacy controls"
      intro="How browser storage may support authentication and product preferences."
      sections={[
        {
          heading: 'Essential cookies',
          body: 'ResolveAI uses secure, HttpOnly authentication cookies and may use essential browser storage for non-sensitive workspace preferences.',
        },
        {
          heading: 'No JWT local storage',
          body: 'Access and refresh tokens are not placed in localStorage by the application authentication flow.',
        },
        {
          heading: 'Configuration',
          body: 'Cookie names, domains, SameSite, Secure, retention, and consent requirements must be reviewed for the production domain and jurisdictions served.',
        },
        {
          heading: 'Contact',
          body: 'For cookie questions, use the configured privacy contact.',
        },
      ]}
    />
  );
}
