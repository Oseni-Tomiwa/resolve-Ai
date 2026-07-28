import { IsEnum } from 'class-validator';

export enum BillingPlanDto {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export class ChangeBillingPlanDto {
  @IsEnum(BillingPlanDto)
  plan!: BillingPlanDto;
}
