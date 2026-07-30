import { IsEnum } from 'class-validator';

export enum BillingPlanDto {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
}

export class BillingCheckoutDto {
  @IsEnum(BillingPlanDto)
  plan!: BillingPlanDto;
}

export class ChangeBillingPlanDto {
  @IsEnum(BillingPlanDto)
  plan!: BillingPlanDto;
}
