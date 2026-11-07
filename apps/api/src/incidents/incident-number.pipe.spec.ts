import { NotFoundException } from '@nestjs/common';
import { IncidentNumberPipe } from './incident-number.pipe';

describe('IncidentNumberPipe', () => {
  const pipe = new IncidentNumberPipe();

  it('parses positive whole numbers', () => {
    expect(pipe.transform('1')).toBe(1);
    expect(pipe.transform('42')).toBe(42);
  });

  it.each(['0', '-1', '1.5', '01', 'abc', 'INC-1', '9999999999', ''])(
    'treats %p as an unknown incident',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(NotFoundException);
    },
  );
});
