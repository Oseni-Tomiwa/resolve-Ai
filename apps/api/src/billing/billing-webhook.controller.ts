import { BadRequestException, Controller, Headers, HttpCode, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
// Nest dependency injection needs this service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { BillingService } from './billing.service';
import { BILLING_PROVIDER, type BillingProvider } from './billing.provider';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@Controller('billing')
export class BillingWebhookController {
  constructor(private readonly service: BillingService, @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider) {}

  @Post('webhook')
  @HttpCode(200)
  async handle(@Req() request: RequestWithRawBody, @Headers('stripe-signature') signature?: string) {
    if (!signature || !request.rawBody) throw new BadRequestException('Stripe webhook signature or raw body is missing');
    const event = this.provider.verifyWebhook(request.rawBody, signature);
    return { received: true, ...(await this.service.handleWebhook(event)) };
  }
}
