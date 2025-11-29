/**
 * Type declarations for @citation-js/core
 */

declare module "@citation-js/core" {
  export class Cite {
    constructor(data: any, options?: any);
    
    static async(data: any, options?: any): Promise<Cite>;
    
    format(format: string, options?: FormatOptions): string;
    
    data: any[];
  }
  
  export interface FormatOptions {
    format?: "text" | "html" | "rtf";
    template?: string;
    lang?: string;
    prepend?: (entry: any) => string;
    append?: (entry: any) => string;
  }
  
  export const plugins: any;
}

declare module "@citation-js/plugin-csl" {
  const plugin: any;
  export default plugin;
}

declare module "@citation-js/plugin-doi" {
  const plugin: any;
  export default plugin;
}
