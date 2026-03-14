import { stddev } from './math';

export class RollingAverage {
  private readonly buffer: Float64Array;

  private head = 0;

  private count = 0;

  private runningSum = 0;

  constructor(private readonly windowSize: number) {
    this.buffer = new Float64Array(windowSize);
  }

  push(value: number): void {
    if (this.count >= this.windowSize) {
      // Subtract the oldest value that will be overwritten
      this.runningSum -= this.buffer[this.head];
    }
    this.buffer[this.head] = value;
    this.runningSum += value;
    this.head = (this.head + 1) % this.windowSize;
    if (this.count < this.windowSize) this.count += 1;
  }

  get average(): number {
    if (!this.count) return 0;
    return this.runningSum / this.count;
  }

  get deviation(): number {
    return stddev(this.toArray());
  }

  get filledCount(): number {
    return this.count;
  }

  get items(): number[] {
    return this.toArray();
  }

  private toArray(): number[] {
    if (!this.count) return [];
    if (this.count < this.windowSize) {
      return Array.from(this.buffer.subarray(0, this.count));
    }
    // Circular: head points to the oldest element
    const result = new Array<number>(this.windowSize);
    for (let i = 0; i < this.windowSize; i++) {
      result[i] = this.buffer[(this.head + i) % this.windowSize];
    }
    return result;
  }
}

export class RollingBuffer<T> {
  private readonly buffer: T[];

  private head = 0;

  private count = 0;

  constructor(private readonly maxSize: number) {
    this.buffer = new Array<T>(maxSize);
  }

  push(value: T): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.maxSize;
    if (this.count < this.maxSize) this.count += 1;
  }

  clear(): void {
    this.count = 0;
    this.head = 0;
  }

  get items(): T[] {
    if (!this.count) return [];
    if (this.count < this.maxSize) {
      return this.buffer.slice(0, this.count);
    }
    const result = new Array<T>(this.maxSize);
    for (let i = 0; i < this.maxSize; i++) {
      result[i] = this.buffer[(this.head + i) % this.maxSize];
    }
    return result;
  }

  get length(): number {
    return this.count;
  }
}
