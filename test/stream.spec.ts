// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { stream, collect, wait } from '$';

describe('stream', () => {
  it('emits one item at a time', async () => {
    const item1 = { a: 'b' };
    const item2 = { a: '232' };
    const item3 = { a: 'xyz' };

    let i = 0;
    for await (const item of stream(item1, item2, item3)) {
      switch (++i) {
        case 1:
          expect(item).toBe(item1);
          break;
        case 2:
          expect(item).toBe(item2);
          break;
        case 3:
          expect(item).toBe(item3);
          break;
      }
    }

    expect(i).toBe(3);
  });

  it('iterates an iterable', async () => {
    const iterable = [2, 4, 6, 8];
    let i = 0;
    for await (const item of stream(iterable)) {
      expect(item).toBe(++i * 2);
    }
    expect(i).toBe(4);
  });

  it('iterates a custom iterable', async () => {
    const iterable = {
      [Symbol.iterator]: function* () {
        yield 2;
        yield 4;
        yield 6;
        yield 8;
      },
    };
    let i = 0;
    for await (const item of stream(iterable)) {
      expect(item).toBe(++i * 2);
    }
    expect(i).toBe(4);
  });
});

describe('collect', () => {
  it('resolves all iterated items as an array', async () => {
    const item1 = { a: 'b' };
    const item2 = { a: '232' };
    const item3 = { a: 'xyz' };

    async function* getItems() {
      await wait(10);
      yield item1;
      await wait(2);
      yield item2;
      await wait(4);
      yield item3;
    }

    const result = await collect(getItems());
    expect(result).toEqual([item1, item2, item3]);
  });
});
