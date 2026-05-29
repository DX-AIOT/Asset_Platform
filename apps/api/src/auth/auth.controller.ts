import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CsrfService } from './csrf.service';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function baseCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    path: '/',
  };
}

@Controller('auth')
export class AuthController {
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(
    private readonly authService: AuthService,
    private readonly csrfService: CsrfService,
  ) {}

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const base = baseCookieOptions(this.isProduction);
    res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: ACCESS_TTL_MS });
    res.cookie(REFRESH_COOKIE, refreshToken, { ...base, maxAge: REFRESH_TTL_MS });
  }

  private clearAuthCookies(res: Response): void {
    const base = baseCookieOptions(this.isProduction);
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
  }

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(registerDto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    this.csrfService.setCsrfCookie(res, this.csrfService.generateToken());
    return { user: result.user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    this.csrfService.setCsrfCookie(res, this.csrfService.generateToken());
    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Cookie takes precedence (web); fall back to request body (mobile)
    const cookieToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const token = cookieToken ?? refreshTokenDto.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Refresh token required');
    }
    const tokens = await this.authService.refreshTokens(token);
    this.csrfService.setCsrfCookie(res, this.csrfService.generateToken());
    if (cookieToken) {
      this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      return {};
    }
    return tokens;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.id);
    this.clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('admin/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async adminResetPassword(@Body() dto: AdminResetPasswordDto) {
    return this.authService.adminResetPassword(dto);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.googleLogin(req.user);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    this.csrfService.setCsrfCookie(res, this.csrfService.generateToken());
    return { user: result.user };
  }
}
