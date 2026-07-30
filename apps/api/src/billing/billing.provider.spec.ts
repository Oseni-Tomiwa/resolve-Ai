import { createHmac } from 'node:crypto';
import { BillingPlanDto } from './billing.dto';
import { StripeBillingProvider, type StripeBillingOptions } from './billing.provider';

const options = (overrides: Partial<StripeBillingOptions> = {}): StripeBillingOptions => ({
  secretKey: 'sk_test_safe',
  webhookSecret: 'whsec_test_safe',
  priceIds: { PRO: 'price_pro', BUSINESS: 'price_business' },
  successUrl: 'https://app.example.com/billing/success',
  cancelUrl: 'https://app.example.com/billing/cancel',
  portalReturnUrl: 'https://app.example.com/dashboard/billing',
  webhookToleranceSeconds: 300,
  ...overrides,
});

describe('StripeBillingProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates a Checkout Session using the configured recurring price', async () => {
    // Arrange
    const provider = new StripeBillingProvider(options());
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'cus_new' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'cs_test', url: 'https://checkout.stripe.com/cs_test' }) } as Response);

    // Act
    const result = await provider.createCheckoutSession({ workspaceId: 'workspace-1', plan: BillingPlanDto.PRO });

    // Assert
    expect(result).toEqual({ provider: 'stripe', sessionId: 'cs_test', checkoutUrl: 'https://checkout.stripe.com/cs_test', providerCustomerId: 'cus_new' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const checkoutRequest = fetchMock.mock.calls[1][1] as RequestInit;
    expect(new URLSearchParams(checkoutRequest.body as string).get('line_items[0][price]')).toBe('price_pro');
    expect((checkoutRequest.headers as Record<string, string>)['Idempotency-Key']).toContain('checkout-workspace-1-PRO');
  });

  it('creates a Customer Portal session for an existing customer', async () => {
    // Arrange
    const provider = new StripeBillingProvider(options());
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ url: 'https://billing.stripe.com/session' }) } as Response);

    // Act
    const result = await provider.createPortalSession({ providerCustomerId: 'cus_existing' });

    // Assert
    expect(result.portalUrl).toBe('https://billing.stripe.com/session');
  });

  it('verifies a signed webhook and rejects tampered payloads', () => {
    // Arrange
    const provider = new StripeBillingProvider(options());
    const body = Buffer.from(JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } }));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', 'whsec_test_safe').update(`${timestamp}.${body.toString('utf8')}`).digest('hex');

    // Act / Assert
    expect(provider.verifyWebhook(body, `t=${timestamp},v1=${signature}`).id).toBe('evt_1');
    expect(() => provider.verifyWebhook(Buffer.from('tampered'), `t=${timestamp},v1=${signature}`)).toThrow('Invalid Stripe webhook signature');
  });

  it('fails in a controlled way when Stripe is not configured', async () => {
    // Arrange
    const provider = new StripeBillingProvider(options({ secretKey: undefined }));

    // Act / Assert
    await expect(provider.createCheckoutSession({ workspaceId: 'workspace-1', plan: BillingPlanDto.BUSINESS })).rejects.toThrow('Stripe billing is not configured');
  });
});
