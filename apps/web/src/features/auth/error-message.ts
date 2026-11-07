import { ApiError } from '../../api/client'

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  return 'Could not reach the server. Please try again.'
}
