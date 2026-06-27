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
