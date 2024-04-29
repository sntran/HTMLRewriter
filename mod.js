import { HTMLRewriter as BaseHTMLRewriter } from "npm:html-rewriter-wasm@0.4.1";

export class HTMLRewriter {
  #elementHandlers = [];
  #documentHandlers = [];

  constructor() {}

  on(selector, handlers) {
    this.#elementHandlers.push([selector, handlers]);
    return this;
  }

  onDocument(handlers) {
    this.#documentHandlers.push(handlers);
    return this;
  }

  transform({ body }) {
    const elementHandlers = this.#elementHandlers;
    const documentHandlers = this.#documentHandlers;
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

    const promise = body.pipeTo(writable);
    promise.catch(() => {
    }).finally(() => rewriter.free());

    return new Response(readable, {
      headers: { "Content-Type": "text/html" },
    });
  }
}
