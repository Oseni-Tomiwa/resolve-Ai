import { Body, Controller, Get, HttpException, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
// Nest dependency injection needs the service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
// Nest validation needs DTO constructors at runtime for reflected parameter metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginDto, RefreshDto, RegisterDto } from './dto';
// Nest dependency injection needs this service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RateLimitService } from '../common/rate-limit.service';
type CookieOptions = { httpOnly: boolean; secure: boolean; sameSite: 'lax' | 'strict' | 'none'; path: string; domain?: string; maxAge?: number };
type CookieResponse = { cookie: (name: string, value: string, options: CookieOptions) => void; clearCookie: (name: string, options: CookieOptions) => void };
type ClientRequest = { ip?: string; headers: { [key: string]: string | string[] | undefined } };
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly rateLimit: RateLimitService) {}
  private protect(request: ClientRequest, route: string): void { const key = `${route}:${request.ip ?? request.headers['x-forwarded-for'] ?? 'unknown'}`; if (!this.rateLimit.allow(key, Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10), Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 60_000))) throw new HttpException({ code: 'RATE_LIMITED', message: 'Please try again shortly.' }, HttpStatus.TOO_MANY_REQUESTS); }
  private cookieOptions(maxAge?: number): CookieOptions { const options: CookieOptions = { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production', sameSite: (process.env.COOKIE_SAME_SITE as CookieOptions['sameSite'] | undefined) ?? 'lax', path: '/' }; if (process.env.COOKIE_DOMAIN) options.domain = process.env.COOKIE_DOMAIN; if (maxAge !== undefined) options.maxAge = maxAge; return options; }
  private setAuthCookies(response: CookieResponse, tokens: { accessToken: string; refreshToken: string }): void { response.cookie('resolveai_access_token', tokens.accessToken, this.cookieOptions(15 * 60 * 1000)); response.cookie('resolveai_refresh_token', tokens.refreshToken, this.cookieOptions(30 * 24 * 60 * 60 * 1000)); }
  private clearAuthCookies(response: CookieResponse): void { response.clearCookie('resolveai_access_token', this.cookieOptions()); response.clearCookie('resolveai_refresh_token', this.cookieOptions()); }
  @Post('register') async register(@Body() dto: RegisterDto, @Req() request: ClientRequest, @Res({ passthrough: true }) response: CookieResponse) { this.protect(request, 'register'); const { user, tokens } = await this.auth.register(dto); this.setAuthCookies(response, tokens); return { success: true, message: 'Account created', data: { user } }; }
  @Post('login') async login(@Body() dto: LoginDto, @Req() request: ClientRequest, @Res({ passthrough: true }) response: CookieResponse) { this.protect(request, 'login'); const { user, tokens } = await this.auth.login(dto); this.setAuthCookies(response, tokens); return { success: true, message: 'Signed in', data: { user } }; }
  @Post('refresh') async refresh(@Body() dto: RefreshDto, @Req() request: ClientRequest & { cookies?: Record<string, string | undefined> }, @Res({ passthrough: true }) response: CookieResponse) { this.protect(request, 'refresh'); const token = dto.refreshToken ?? request.cookies?.resolveai_refresh_token; if (!token) return this.auth.refresh(''); const tokens = await this.auth.refresh(token); this.setAuthCookies(response, tokens); return { success: true, message: 'Token refreshed', data: { authenticated: true } }; }
  @Post('logout') async logout(@Body() dto: RefreshDto, @Req() request: { cookies?: Record<string, string | undefined> }, @Res({ passthrough: true }) response: CookieResponse) { await this.auth.logout(dto.refreshToken ?? request.cookies?.resolveai_refresh_token ?? ''); this.clearAuthCookies(response); return { success: true, message: 'Signed out', data: null }; }
  @Get('me') @UseGuards(JwtAuthGuard) me(@Req() request: { user?: { sub: string } }) { if (!request.user) return { success: false, message: 'Authentication required', error: { code: 'UNAUTHORIZED', details: [] } }; return this.auth.me(request.user.sub).then((data) => ({ success: true, message: 'Current user', data })); }
}
