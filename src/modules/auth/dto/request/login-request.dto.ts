import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginRequestDto {

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password: string;

}