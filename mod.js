import { HTMLRewriter as BaseHTMLRewriter } from "html-rewriter-wasm";

/**
 * @typedef {import("html-rewriter-wasm").DocumentHandlers} DocumentHandlers
 */

/**
 * @typedef {import("html-rewriter-wasm").ElementHandlers} ElementHandlers
 */

/**
 * An API for traversing and transforming HTML documents.
 *
 * Example:
 *
 * ```ts
 * import { HTMLRewriter } from "./mod.js";
 *
 * const rewriter = new HTMLRewriter();
 * rewriter.on("img, iframe", {
 *   element(element) {
 *     if (!element.hasAttribute("loading")) {
 *       element.setAttribute("loading", "lazy");
 *     }
 *   },
 * });
 * rewriter.transform(await fetch("https://example.com"));
 * ```
 */
export class HTMLRewriter {
  /**
   * @type {Array<[string, ElementHandlers]>}
   */
  #elementHandlers = [];
  /**
   * @type {Array<DocumentHandlers>}
   */
  #documentHandlers = [];

  constructor() {}

  /**
   * Attaches a handler to the document
   * @param {DocumentHandlers} handlers
   * @returns {this}
   */
  onDocument(handlers) {
    this.#documentHandlers.push(handlers);
    return this;
  }

  /**
   * Attaches a handler to an element matching the selector
   * @param {string} selector CSS selector to match on
   * @param {ElementHandlers} handlers
   * @returns {this}
   */
  on(selector, handlers) {
    this.#elementHandlers.push([selector, handlers]);
    return this;
  }

  /**
   * Transforms the response body using the attached handlers
   * @param {Response} response
   * @returns {Response}
   */
  transform(response) {
    const body = response.body;
    if (!body) {
      return response;
    }

    const elementHandlers = this.#elementHandlers;
    const documentHandlers = this.#documentHandlers;
    /**
     * @type {BaseHTMLRewriter}
     */
    let rewriter;

    const { readable, writable } = new TransformStream({
      start(controller) {
        rewriter = new BaseHTMLRewriter((chunk) => {
          if (chunk.length !== 0) {
            controller.enqueue(chunk);
          }
        });

        for (const [selector, handlers] of elementHandlers) {
          rewriter.on(selector, handlers);
        }
        for (const handlers of documentHandlers) {
          rewriter.onDocument(handlers);
        }
      },

      transform: (chunk) => rewriter.write(chunk),
      flush: () => rewriter.end(),
    });

    const promise = response.body.pipeTo(writable);
    promise.catch(() => {
    }).finally(() => rewriter.free());

    return new Response(readable, {
      headers: { "Content-Type": "text/html" },
    });
  }
}
