import {
  DocumentHandlers,
  ElementHandlers,
  HTMLRewriter as BaseHTMLRewriter,
} from "npm:html-rewriter-wasm@0.4.1";

export class HTMLRewriter {
  #elementHandlers: Array<[string, ElementHandlers]> = [];
  #documentHandlers: Array<DocumentHandlers> = [];

  constructor() {}

  /**
   * Attaches a handler to the document
   * @param {DocumentHandlers} handlers
   * @returns {this}
   */
  onDocument(handlers: DocumentHandlers): this {
    this.#documentHandlers.push(handlers);
    return this;
  }

  /**
   * Attaches a handler to an element matching the selector
   * @param {string} selector CSS selector to match on
   * @param {ElementHandlers} handlers
   * @returns {this}
   */
  on(selector: string, handlers: ElementHandlers): this {
    this.#elementHandlers.push([selector, handlers]);
    return this;
  }

  /**
   * Transforms the response body using the attached handlers
   * @param {Response} response
   * @returns {Response}
   */
  transform(response: Response): Response {
    const body = response.body;
    if (!body) {
      return response;
    }

    const elementHandlers = this.#elementHandlers;
    const documentHandlers = this.#documentHandlers;
    let rewriter: BaseHTMLRewriter;

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
