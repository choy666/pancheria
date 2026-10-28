import { getLogoTargetSize } from './brand-logo-normalize';

describe('getLogoTargetSize', () => {
  test('reduce el lado mayor a 512 px conservando la proporción', () => {
    expect(getLogoTargetSize(1024, 512)).toEqual({ width: 512, height: 256 });
    expect(getLogoTargetSize(300, 2000)).toEqual({ width: 77, height: 512 });
  });

  test('no agranda los logos que ya entran', () => {
    expect(getLogoTargetSize(200, 120)).toEqual({ width: 200, height: 120 });
  });

  test('nunca devuelve una dimensión menor a 1 px', () => {
    expect(getLogoTargetSize(1, 4000)).toEqual({ width: 1, height: 512 });
  });
});
