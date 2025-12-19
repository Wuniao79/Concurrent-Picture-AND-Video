export type HttpError = Error & {
  status?: number;
  statusCode?: number;
  body?: string;
};

export const createHttpError = (status: number, message: string, body?: string): HttpError => {
  const err = new Error(message) as HttpError;
  err.status = status;
  err.statusCode = status;
  if (body) err.body = body;
  return err;
};

