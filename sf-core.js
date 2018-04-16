class SFComponent {
  constructor(element, href = null) {
    href = typeof href === "string" ? href : '/elements/' + element + '.html';
    if (Array.isArray(element)) {
      return element.map(e => new SFComponent(e));
    } else if (typeof element == 'object') {
      return Object.keys(element).map(k => new SFComponent(k, element[k]));
    }
    SFComponent[element] = this;

    function createCustomElements() {
      if (window.WebComponents.ready) {
        createComponent(element, href, SFComponent[element]);
        return;
      }
      requestAnimationFrame(createCustomElements);
    }
    requestAnimationFrame(createCustomElements);
  }
  static updateState(target, oldState) {
    let c = SFComponent[target.tagName.toLowerCase()];
    if (!c || !c.vdom) return;
    let vdom = SFComponent.evaluateVDOM(c.vdom, target.state);
    if (c.sr) SFComponent.replaceNode(target.shadowRoot, vdom, target);
    else SFComponent.replaceNode(target, vdom, target);
    if (typeof c.stateChangeCallback === 'function') {
      c.stateChangeCallback(target, oldState, target.state);
    }
    if (typeof SFComponent.stateChanged === 'function') {
      SFComponent.stateChanged(target, oldState, target.state);
    }
  }
  static toVDOM(html, dom = false, state = false) {
    if (NodeList.prototype.isPrototypeOf(html) || Array.isArray(html)) {
      let ans = [];
      html.forEach(v => ans.push(SFComponent.toVDOM(v, dom, state)));
      return ans;
    } else if (html.nodeType === 3 || typeof html === 'string') {
      const x = html.nodeValue || html;
      return {
        tag: '#text',
        data: x,
        state: x.indexOf('${') > -1 || state
      }
    } else {
      let nstate = false;
      const attrs = html.attributes || {},
        l = attrs.length,
        attr = [];
      for (let i = 0; i < l; i++) {
        attr[attrs[i].name] = {
          value: attrs[i].value,
          state: attrs[i].value.indexOf('${') > -1 || state
        }
        if (attr[attrs[i].name].state) nstate = true;
      }
      let ans = {
        tag: html.nodeName,
        attrs: attr,
        children: SFComponent.toVDOM(html.childNodes, dom, state)
      }
      if (dom) ans.dom = html;
      ans.children.forEach(c => {
        if(c.state) nstate = true;
      });
      ans.state = state || nstate;
      return ans;
    }
  }
  static toHTML(node, frag = false) {
    if (Array.isArray(node)) {
      if (frag) {
        let x = document.createDocumentFragment();
        node.forEach(v => x.appendChild(SFComponent.toHTML(v)));
        return x;
      } else {
        return node.map(v => SFComponent.toHTML(v));
      }
    } else if (!node) {
      return node;
    } else {
      if (node.dom) return node.dom;
      let html;
      switch (node.tag) {
        case '#text':
          html = document.createTextNode(node.data);
          break;
        case '#comment':
          html = document.createComment('comment');
          break;
        default:
          html = document.createElement(node.tag);
          for (let name in node.attrs) {
            html.setAttribute(name, node.attrs[name].value);
          }
          SFComponent.toHTML(node.children).forEach(c => html.appendChild(c));
          break;
      }
      return html;
    }
  }
  static evaluateVDOM(vdom, state) {
    if (Array.isArray(vdom)) {
      return [].concat(...vdom.map(v => SFComponent.evaluateVDOM(v, state)));
    } else if (!vdom) {
      return vdom;
    } else {
      switch (vdom.tag) {
        case '#text':
          if (!vdom.state) return vdom;
          let replacing = SFComponent.evaluateString(vdom.data, state)
          if (!replacing) return;
          if (Array.isArray(replacing) || replacing.nodeType) {
            return SFComponent.toVDOM(replacing, true, true);
          } else {
            if (typeof replacing !== 'string') replacing = tryStringify(replacing);
            if (replacing.indexOf('<') < 0) {
              return SFComponent.toVDOM(replacing, true, true);
            } else {
              let x = document.createElement('body');
              x.innerHTML = replacing;
              return SFComponent.toVDOM(x.childNodes, true, true);
            }
          }
          break;
        default:
          let ans = {
            tag: vdom.tag,
            attrs: {},
            children: SFComponent.evaluateVDOM(vdom.children, state),
            state: vdom.state
          }
          for (let name in vdom.attrs) {
            if (vdom.attrs[name].state) {
              ans.attrs[name] = {
                state: true,
                value: SFComponent.evaluateString(vdom.attrs[name].value, state)
              }
            } else {
              ans.attrs[name] = vdom.attrs[name];
            }
          }
          return ans;
      }
    }
  }
  static replaceNode(dom, vdom) {
    if (!dom || !vdom) {
      return;
    } else if (vdom.tag !== dom.nodeName && vdom.tag !== "#document-fragment") {
      dom.replaceWith(SFComponent.toHTML(vdom));
      return;
    } else if (vdom.tag === '#text') {
      if (vdom.state && dom.nodeValue !== vdom.data) dom.nodeValue = vdom.data;
      return;
    } else if (vdom.tag === 'SELECT') {
      dom.value = vdom.attrs['value'].value;
    }
    if (vdom.state) {
      this.replaceChildren(dom.childNodes, vdom.children, dom)
      SFComponent.replaceAttributes(dom, vdom);
    }
  }
  static replaceAttributes(dom, vdom) {
    for (let name in vdom.attrs) {
      if (vdom.attrs[name].state) {
        dom.setAttribute(name, vdom.attrs[name].value);
      }
    }
  }
  static replaceChildren(doms, vdoms, parent) {
    let j = 0;
    let frag = [];
    vdoms.forEach((v, i) => {
      while (SFComponent.skip(doms[j])) {
        j++;
      }
      if (v && v.attrs && v.attrs['data-key'] && doms[j] && doms[j].dataset && v.attrs['data-key'].value !== doms[j].dataset.key) {
        if (doms[j + 1] && doms[j + 1].dataset && v.attrs['data-key'].value === doms[j + 1].dataset.key) doms[j].remove();
        if (doms[j + 2] && doms[j + 2].dataset && v.attrs['data-key'].value === doms[j + 2].dataset.key) {
          doms[j].remove();
          doms[j + 1].remove();
        }
      }
      if (!doms[j]) {
        frag.push(v);
        j++;
        return;
      } else {
        SFComponent.replaceNode(doms[j], v);
      }
      j++;
    });
    while (doms[j]) {
      if (!SFComponent.skip(doms[j])) {
        doms[j].remove();
      } else {
        j++;
      }
    }
    if (frag.length > 0) {
      parent.appendChild(SFComponent.toHTML(frag, true));
    }
  }
  static skip(el) {
    return el && (el.skip || (el.dataset && el.dataset.skip));
  }
  static evaluateString(string, state) {
    if (string.indexOf('${') < 0) return string;
    string = string.trim();
    let binder = '';
    for (let i in state) {
      binder += 'let ' + i + ' = this["' + i + '"]; ';
    }
    if (string.indexOf('${') === 0) return replacer(string);
    return string.replace(/\${([^{}\$]|{([^{}\$])*})*}/g, replacer);

    function replacer(match) {
      let g1 = match.slice(2, -1);

      function executeCode() {
        let f;
        if (g1.search('return') >= 0) {
          f = new Function(binder + g1).bind(state);
        } else {
          f = new Function(binder + 'return ' + g1).bind(state);
        }
        try {
          return f();
        } catch (e) {
          return match;
        }
      }
      return executeCode();
    }
  }
  static absolute(base, relative) {
    var stack = base.split("/"),
      parts = relative.split("/");
    stack.pop();
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] == ".")
        continue;
      if (parts[i] == "..")
        stack.pop();
      else
        stack.push(parts[i]);
    }
    return stack.join("/");
  }
  static getRoutes(url) {
    if (url[0] != '/') {
      url = '/' + url;
    }
    let qIndex = url.indexOf("?");
    if (qIndex != -1) {
      url = url.substring(0, qIndex);
    }
    return url.split("/");
  }
  static twoWayBind(e) {
    const target = e.composedPath() ? e.composedPath()[0] : e.target;
    target.setAttribute("value", target.value);
    if (!target.dataset || !target.dataset.bindTo) {
      return;
    }
    let host = target.getRootNode();
    let sr = host,
      range, startN, startO, endN, endO;
    if (!target.value) {
      range = sr.getSelection().getRangeAt(0).cloneRange();
      [startN, startO, endN, endO] = [range.startContainer, range.startOffset, range.endContainer, range.endOffset];
    }
    host = host.host;
    let data = {};
    data[target.dataset.bindTo] = typeof target.value === 'string' ? target.value :
      target.innerHTML.trim()
            .replace(/(&lt;)(((?!&gt;).)*)(&gt;)(((?!&lt;).)*)(&lt;)\/(((?!&gt;).)*)(&gt;)/g, '<$2>$5</$8>')
            .replace(/(&lt;)(input|link|img|br|hr|col|keygen)(((?!&gt;).)*)(&gt;)/g, '<$2$3>');
    host.state = data;
    if (!target.value) {
      range.setStart(startN, startO);
      range.setEnd(endN, endO);
      sr.getSelection().removeAllRanges();
      sr.getSelection().addRange(range);
    }
  }
  static clickHandler(e) {
    e = e || window.event;
    let target = e.composedPath()[0] || e.target || e.srcElement;
    for (let k in SFComponent.clickEvents) {
      let x = target;
      while (x) {
        if (x.matches(k)) {
          var fn = SFComponent.clickEvents[k];
          if (typeof fn === "function") {
            fn(x, e);
          }
        }
        if (x) {
          x = x.parentElement;
        }
      }
    }
  }
}
function createComponent(element, href, c) {
  if (!element) {
    console.log(`Error creating element: No element name - ${element}.`);
    return;
  } else if (window.customElements.get(element)) {
    console.log(`Error creating element: Element (${element}) already defined.`);
    return;
  } else if (element.indexOf("-") < 1) {
    console.log(`Error creating element: Element name (${element}) must have one "-".`);
    return;
  }
  let link = document.createElement('link');
  const cl = class extends HTMLElement {
    static get observedAttributes() {
      c.observedAttributes = c.observedAttributes || [];
      return ['data-bind'].concat(c.observedAttributes);
    }
    constructor() {
      super();
      const template = link.import.querySelector('template');
      if (template.getAttribute("relative-url") == "true") {
        var base = link.href;
        let insideHtml = template.innerHTML;
        let href_regex = /href=['"]?((?!http)[a-zA-z.\/\-\_]+)['"]?/g;
        let src_regex = /src=['"]?((?!http)[a-zA-z.\/\-\_]+)['"]?/g;
        let newHtml = insideHtml.replace(href_regex, replacer);
        newHtml = newHtml.replace(src_regex, replacer);

        function replacer(match, g1) {
          return match.replace(g1, SFComponent.absolute(base, g1));
        }
        template.innerHTML = newHtml;
      }
      if (template.getAttribute('shadow-root') === "false") {
        c.sr = false;
      } else {
        const shadowRoot = this.attachShadow({
          mode: 'open'
        }).appendChild(template.content.cloneNode(true));
        c.sr = true;
      }
      if (template.getAttribute('state') === "false") Object.defineProperty(this, 'state', {
        set: function(v) {
          this._state = v;
        }
      });
      c.vdom = SFComponent.toVDOM(template.content.cloneNode(true));
      if (typeof c.createdCallback === "function") {
        c.createdCallback(this);
      }
    }
    attributeChangedCallback(attrName, oldVal, newVal) {
      if (attrName === "data-bind") {
        this.state = {
          bind: tryParseJSON(newVal)
        }
      }
      if (typeof c.attributeChangedCallback === "function") {
        c.attributeChangedCallback(this, attrName, oldVal, newVal);
      }
    }
    connectedCallback() {
      let defaultState = c.defaultState || {};
      let dataBind = tryParseJSON(this.dataset.bind) || {};
      let oldState = this.state;
      this.state = Object.assign(defaultState, {
        bind: dataBind
      }, oldState);
      if (this.shadowRoot) this.shadowRoot.addEventListener('change', SFComponent.twoWayBind);
      else this.addEventListener('change', SFComponent.twoWayBind);
      if (typeof c.connectedCallback === "function") {
        c.connectedCallback(this);
      }
    }
    disconnectedCallback() {
      if (typeof c.disconnectedCallback === "function") {
        c.disconnectedCallback(this);
      }
    }
    clone(deep = true) {
      let ans = this.cloneNode(deep);
      ans.state = this.state;
      return ans;
    }
    get state() {
      return this._state;
    }
    set state(v) {
      this._state = this._state || {};
      let oldState = Object.assign({}, this._state);
      Object.assign(this._state, v);
      SFComponent.updateState(this, oldState);
    }
    clearState() {
      this._state = {};
      SFComponent.updateState(this);
    }
  }
  link.rel = 'import';
  link.href = href;
  link.setAttribute('async', '');
  link.onload = function(e) {
    try {
      window.customElements.define(element, cl);
    } catch (e) {
      console.log(element, e);
    }
  }
  link.onerror = function(e) {
    console.log(e);
  }
  document.head.appendChild(link);
}

function tryParseJSON(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return jsonString;
  }
}

function tryStringify(json) {
  if (typeof json === "string") {
    return json;
  } else {
    return JSON.stringify(json);
  }
}

function loadPolyfills() {
  window.WebComponents = window.WebComponents || {};
  let polyfills = [];
  if (!('import' in document.createElement('link'))) {
    polyfills.push('hi');
  }
  if (!('attachShadow' in Element.prototype && 'getRootNode' in Element.prototype) ||
    (window.ShadyDOM && window.ShadyDOM.force)) {
    polyfills.push('sd');
  }
  if (!window.customElements || window.customElements.forcePolyfill) {
    polyfills.push('ce');
  }
  if (!('content' in document.createElement('template')) || !window.Promise || !Array.from ||
    !(document.createDocumentFragment().cloneNode() instanceof DocumentFragment)) {
    polyfills = ['lite'];
  }

  if (polyfills.length) {
    let script = document.querySelector('script[src*="sf-core.js"]') || document.querySelector('script[src*="sf-core.min.js"]');
    let newScript = document.createElement('script');
    let replacement = 'polyfills/webcomponents-' + polyfills.join('-') + '.js';
    let url = script.src.replace(/sf-core.(min\.)?js/, replacement);
    newScript.src = url;
    if (document.readyState === 'loading' && ('import' in document.createElement('link'))) {
      document.write(newScript.outerHTML);
    } else {
      document.head.appendChild(newScript);
    }
  } else {
    window.WebComponents.ready = true;
  }
}

loadPolyfills();
document.addEventListener('input', SFComponent.twoWayBind);
document.addEventListener('click', SFComponent.clickHandler);
SFComponent.clickEvents = {};