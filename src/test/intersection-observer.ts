// A stand-in for IntersectionObserver, which jsdom does not have. Tests say when an element is on screen.
export class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: number[] = []
  readonly elements = new Set<Element>()
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    FakeIntersectionObserver.instances.push(this)
  }

  observe(element: Element) {
    this.elements.add(element)
  }

  unobserve(element: Element) {
    this.elements.delete(element)
  }

  disconnect() {
    this.elements.clear()
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  report(element: Element, isIntersecting: boolean) {
    const entry = { target: element, isIntersecting } as IntersectionObserverEntry
    this.callback([entry], this as unknown as IntersectionObserver)
  }
}

export function setElementOnScreen(element: Element, isIntersecting: boolean) {
  for (const observer of FakeIntersectionObserver.instances) {
    if (observer.elements.has(element)) observer.report(element, isIntersecting)
  }
}

export function setAllObservedOnScreen(isIntersecting: boolean) {
  for (const observer of FakeIntersectionObserver.instances) {
    for (const element of observer.elements) observer.report(element, isIntersecting)
  }
}
