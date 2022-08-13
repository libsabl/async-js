// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

/** Stream an iterable of items as an async iterable  */
export function stream<T>(items: Iterable<T>): AsyncIterable<T>;

/** Stream a plain array of items as an async iterable  */
export function stream<T>(...items: T[]): AsyncIterable<T>;

export async function* stream<T>(...items: T[]): AsyncIterable<T> {
  if (items.length == 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item1 = <any>items[0];
    if (
      typeof item1 === 'object' &&
      typeof item1[Symbol.iterator] === 'function'
    ) {
      items = item1;
    }
  }
  for (const i of items) {
    yield i;
  }
}

/** Collect all items from an async iterable and resolve as an array */
export async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const i of stream) {
    arr.push(i);
  }
  return arr;
}
