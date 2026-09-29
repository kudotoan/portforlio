import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordRequestDto {

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(256)
  newPassword: string;

}