import {
  Injectable,
  NotFoundException,
  type PipeTransform,
} from '@nestjs/common';

// Parses the per-organization incident number from the URL. Anything that
// is not a positive whole number is just an unknown incident.
@Injectable()
export class IncidentNumberPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^[1-9]\d{0,8}$/.test(value)) {
      throw new NotFoundException('Incident not found');
    }

    return Number(value);
  }
}
