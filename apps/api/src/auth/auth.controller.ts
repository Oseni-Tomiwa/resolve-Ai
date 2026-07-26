import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
// Nest dependency injection needs the service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
// Nest validation needs DTO constructors at runtime for reflected parameter metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginDto, RefreshDto, RegisterDto } from './dto';
type CookieOptions = { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge?: number };
type CookieResponse = { cookie: (name: string, value: string, options: CookieOptions) => void; clearCookie: (name: string, options: CookieOptions) => void };
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  private setAuthCookies(response: CookieResponse, tokens: { accessToken: string; refreshToken: string }): void { const secure = process.env.NODE_ENV === 'production'; response.cookie('resolveai_access_token', tokens.accessToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 15 * 60 * 1000 }); response.cookie('resolveai_refresh_token', tokens.refreshToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 * 1000 }); }
  private clearAuthCookies(response: CookieResponse): void { response.clearCookie('resolveai_access_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' }); response.clearCookie('resolveai_refresh_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' }); }
  @Post('register') async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: CookieResponse) { const { user, tokens } = await this.auth.register(dto); this.setAuthCookies(response, tokens); return { success: true, message: 'Account created', data: { user } }; }
  @Post('login') async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: CookieResponse) { const { user, tokens } = await this.auth.login(dto); this.setAuthCookies(response, tokens); return { success: true, message: 'Signed in', data: { user } }; }
  @Post('refresh') async refresh(@Body() dto: RefreshDto, @Req() request: { cookies?: Record<string, string | undefined> }, @Res({ passthrough: true }) response: CookieResponse) { const token = dto.refreshToken ?? request.cookies?.resolveai_refresh_token; if (!token) return this.auth.refresh(''); const tokens = await this.auth.refresh(token); this.setAuthCookies(response, tokens); return { success: true, message: 'Token refreshed', data: { authenticated: true } }; }
  @Post('logout') async logout(@Body() dto: RefreshDto, @Req() request: { cookies?: Record<string, string | undefined> }, @Res({ passthrough: true }) response: CookieResponse) { await this.auth.logout(dto.refreshToken ?? request.cookies?.resolveai_refresh_token ?? ''); this.clearAuthCookies(response); return { success: true, message: 'Signed out', data: null }; }
  @Get('me') @UseGuards(JwtAuthGuard) me(@Req() request: { user?: { sub: string } }) { if (!request.user) return { success: false, message: 'Authentication required', error: { code: 'UNAUTHORIZED', details: [] } }; return this.auth.me(request.user.sub).then((data) => ({ success: true, message: 'Current user', data })); }
}
