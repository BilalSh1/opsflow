import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import type { AccessTokenPayload } from './interfaces/access-token-payload.interface';
import type {
  AuthResult,
  LoginResponse,
  MeResponse,
  RefreshResponse,
  RegisterResponse,
} from './interfaces/auth-response.interface';
import {
  REFRESH_TOKEN_COOKIE,
  refreshTokenCookieOptions,
} from './refresh-token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto): Promise<RegisterResponse> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.login(loginDto);

    return this.sendAuthResult(result, response);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponse> {
    const result = await this.authService.refresh(
      this.getRefreshToken(request),
    );

    return this.sendAuthResult(result, response);
  }

  // Not guarded by the access token, so a user whose access token has
  // expired can still log out.
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.getRefreshToken(request));

    response.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  getMe(@CurrentUser() currentUser: AccessTokenPayload): Promise<MeResponse> {
    return this.authService.getCurrentUser(currentUser.sub);
  }

  private sendAuthResult(
    result: AuthResult,
    response: Response,
  ): LoginResponse {
    response.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
      ...this.cookieOptions(),
      expires: result.refreshTokenExpiresAt,
    });

    return result.body;
  }

  private getRefreshToken(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[REFRESH_TOKEN_COOKIE];

    return typeof token === 'string' ? token : undefined;
  }

  private cookieOptions() {
    return refreshTokenCookieOptions(
      this.configService.get<string>('NODE_ENV') === 'production',
    );
  }
}
