declare module "bwip-js" {
  interface ToCanvasOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    width?: number;
    columns?: number;
    rows?: number;
    includetext?: boolean;
    textxalign?: string;
    [key: string]: any;
  }
  function toCanvas(canvas: HTMLCanvasElement, options: ToCanvasOptions): HTMLCanvasElement;
  export default { toCanvas };
}
