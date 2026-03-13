import { stddev } from './math';

export class RollingAverage {
  private values: number[] = [];

  constructor(private readonly windowSize: number) {}

  push(value: number): void {
    this.values.push(value);
    if (this.values.length > this.windowSize) this.values.shift();
  }

  get average(): number {
    if (!this.values.length) return 0;
    return this.values.reduce((sum, value) => sum + value, 0) / this.values.length;
  }

  get deviation(): number {
    return stddev(this.values);
  }

  get items(): number[] {
    return [...this.values];
  }
}

export class RollingBuffer<T> {
  private values: T[] = [];

  constructor(private readonly maxSize: number) {}

  push(value: T): void {
    this.values.push(value);
    if (this.values.length > this.maxSize) this.values.shift();
  }

  clear(): void {
    this.values = [];
  }

  get items(): T[] {
    return [...this.values];
  }

  get length(): number {
    return this.values.length;
  }
}
