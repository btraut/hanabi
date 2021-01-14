// https://davidgomes.com/pick-omit-over-union-types-in-typescript/
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export default DistributiveOmit;
