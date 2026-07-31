import { IsEnum, IsIn } from 'class-validator';

export enum BillingPlanDto {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
}

export class BillingCheckoutDto {
  @IsEnum(BillingPlanDto)
  @IsIn([BillingPlanDto.PRO, BillingPlanDto.BUSINESS])
  plan!: BillingPlanDto;
}

export class ChangeBillingPlanDto {
  @IsEnum(BillingPlanDto)
  @IsIn([BillingPlanDto.FREE, BillingPlanDto.PRO, BillingPlanDto.BUSINESS])
  plan!: BillingPlanDto;
}
