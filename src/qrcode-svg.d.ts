declare module 'qrcode-svg' {
  interface QRCodeOptions {
    content: string;
    padding?: number;
    width?: number;
    height?: number;
    color?: string;
    background?: string;
    ecl?: 'L' | 'M' | 'Q' | 'H';
  }
  class QRCode {
    constructor(options: QRCodeOptions);
    svg(): string;
  }
  export = QRCode;
}

declare module '../../../devnoder-executor/index.js' {
  const worker: {
    fetch(request: Request, env?: Record<string, unknown>): Promise<Response>;
  };
  export default worker;
}

declare module '../../../devnoder-oauth/index.js' {
  const worker: {
    fetch(request: Request, env?: Record<string, string>): Promise<Response>;
  };
  export default worker;
}
