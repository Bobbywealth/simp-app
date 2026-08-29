// Ambient declaration for `sanitize-html` so TypeScript can resolve
// the module even when `@types/sanitize-html` is not installed
// (Render's production image runs `npm install` with devDependencies
// pruned, and the @types package is in devDependencies).
//
// Field order matters here: TypeScript merges a `function f(...) {}`
// declaration with a `namespace f { ... }` declaration into a single
// callable+namespace value, which is how `@types/sanitize-html` itself
// exposes `sanitizeHtml.IOptions`. The function declaration must come
// *before* the namespace block so that the namespace merges onto the
// function value.
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

  function sanitizeHtml(html: string, options?: IOptions): string;
  function sanitizeHtml(
    html: string,
    options: IOptions & { returnText: true },
  ): string[];

  namespace sanitizeHtml {
    interface Attributes {
      TAG?: string;
      ATTR?: string;
    }

    interface Tags {
      name: string;
      attributes?: string[];
      [key: string]: unknown;
    }

    function defaults(options?: IOptions): IOptions;

    // Re-export IOptions under the namespace so legacy callers
    // (`sanitizeHtml.IOptions`) resolve. The duplicate name is legal
    // here because TypeScript treats the function-with-namespace merge
    // as the namespace name's own scope.
    export { IOptions };
  }

  export default sanitizeHtml;
}
