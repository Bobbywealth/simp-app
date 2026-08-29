// Ambient declaration for `sanitize-html` so TypeScript can resolve the
// module even when `@types/sanitize-html` is not installed (Render's
// production image runs `npm install` with devDependencies pruned).
//
// The shape mirrors `@types/sanitize-html@2.16.x` for the fields we
// actually use. Any field accepted by sanitize-html but not declared
// here will fall back to `any`, which is acceptable since the actual
// runtime shape is owned by the package itself.
declare module 'sanitize-html' {
  type AttributeMap = { readonly [name: string]: string };
  type TransformTagFn = (
    tagName: string,
    attribs: AttributeMap,
  ) => { tagName: string; attribs: AttributeMap };

  interface IOptions {
    allowedTags?: readonly string[];
    allowedAttributes?: { readonly [tag: string]: readonly string[] };
    allowedSchemes?: readonly string[];
    allowedSchemesByTag?: { readonly [tag: string]: readonly string[] };
    allowedSchemesAppliedToAttributes?: {
      readonly [attr: string]: readonly string[];
    };
    transformTags?:
      | { readonly [tag: string]: string | false }
      | { readonly [tag: string]: TransformTagFn };
    textFilter?: (text: string, tagName: string) => string;
    parser?: { [key: string]: unknown };
  }

  interface defaults {
    defaults: IOptions;
  }

  interface Attributes {
    TAG?: string;
    ATTR?: string;
  }

  interface Tags {
    name: string;
    attributes?: string[];
    [key: string]: unknown;
  }

  function sanitizeHtml(html: string, options?: IOptions): string;
  function sanitizeHtml(
    html: string,
    options: IOptions & { returnText: true },
  ): string[];

  namespace sanitizeHtml {
    function defaults(options?: IOptions): IOptions;
  }

  export default sanitizeHtml;
}
