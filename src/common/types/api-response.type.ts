export type ApiSuccessResponse<DataType> = {
  success: true;
  statusCode: number;
  message: string;
  data: DataType;
  timestamp: string;
  path: string;
  requestId: string;
};

export type ApiErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
  details: unknown[];
  timestamp: string;
  path: string;
  requestId: string;
};