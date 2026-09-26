import { HttpClient, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

/** Pins the network guard in `test-setup.ts`: a spec can no longer reach a live API by accident. */
describe('unit-test network guard', () => {
  it('rejects a real fetch with a message that names the fix', async () => {
    await expect(fetch('https://api.milescaira.com/v2/library/')).rejects.toThrow(
      /real network request to https:\/\/api\.milescaira\.com\/v2\/library\/.*provideHttpClientTesting/,
    );
  });

  it('fails an HttpClient request fast instead of calling the live API', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const http = TestBed.inject(HttpClient);

    await expect(
      firstValueFrom(http.get('https://api.milescaira.com/v2/library/')),
    ).rejects.toMatchObject({
      status: 0,
    });
  });
});
