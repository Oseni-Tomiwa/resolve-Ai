import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest validation needs the DTO constructor at runtime for reflected parameter metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { OnboardingDto, OnboardingProgressDto } from './dto';
// Nest dependency injection needs the service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}
  @Get('status') status(@Req() request: { user: { sub: string } }) { return this.service.status(request.user.sub).then((data) => ({ success: true, message: 'Onboarding status loaded', data })); }
  @Post() create(@Req() request: { user: { sub: string } }, @Body() dto: OnboardingDto) { return this.service.create(request.user.sub, dto).then((data) => ({ success: true, message: 'Workspace created', data })); }
  @Patch('progress') progress(@Req() request: { user: { sub: string } }, @Body() dto: OnboardingProgressDto) { return this.service.updateProgress(request.user.sub, dto).then((data) => ({ success: true, message: 'Onboarding progress saved', data })); }
  @Post('complete') complete(@Req() request: { user: { sub: string } }) { return this.service.complete(request.user.sub).then((data) => ({ success: true, message: 'Onboarding complete', data })); }
}
