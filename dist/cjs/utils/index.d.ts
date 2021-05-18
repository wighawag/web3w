declare type Config = {
    error: unknown;
};
declare type Func<T> = () => T;
export declare function timeout<T>(time: number, p: Promise<T>, config?: Config | Func<T>): Promise<T>;
export {};
//# sourceMappingURL=index.d.ts.map