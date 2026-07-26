import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { LoginDto, RefreshDto, RegisterDto } from './dto';
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto).then((data) => ({ success: true, message: 'Account created', data })); }
  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto).then((data) => ({ success: true, message: 'Signed in', data })); }
  @Post('refresh') refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken).then((data) => ({ success: true, message: 'Token refreshed', data })); }
  @Post('logout') logout(@Body() dto: RefreshDto) { return this.auth.logout(dto.refreshToken).then(() => ({ success: true, message: 'Signed out', data: null })); }
  @Get('me') @UseGuards(JwtAuthGuard) me(@Req() request: { user?: { sub: string } }) { if (!request.user) return { success: false, message: 'Authentication required', error: { code: 'UNAUTHORIZED', details: [] } }; return this.auth.me(request.user.sub).then((data) => ({ success: true, message: 'Current user', data })); }
}
