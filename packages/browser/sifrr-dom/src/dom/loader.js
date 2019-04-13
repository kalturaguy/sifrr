const template = require('./template');

class Loader {
  constructor(elemName, url) {
    if (!window.fetch) throw Error('Sifrr.Dom.load requires Fetch API to work.');
    if (this.constructor.all[elemName]) return this.constructor.all[elemName];
    this.elementName = elemName;
    Loader.add(this.elementName, this);
    this.url = url;
  }

  executeScripts(js = true) {
    if (this._exec) return this._exec;
    if (!js) {
      return this._exec = this.executeHTMLScripts(), this._exec;
    } else {
      return this._exec = this.constructor.executeJS(this.getUrl('js')).catch((e) => {
        window.console.error(e);
        window.console.log(`JS file for '${this.elementName}' gave error. Trying to get html file.`);
        return this.executeHTMLScripts();
      }), this._exec;
    }
  }

  executeHTMLScripts() {
    return this.constructor.executeHTML(this.getUrl('html'), this);
  }

  getUrl(type = 'js') {
    return this.url || `${window.Sifrr.Dom.config.baseUrl + '/'}elements/${this.elementName.split('-').join('/')}.${type}`;
  }

  static add(elemName, instance) {
    Loader.all[elemName] = instance;
  }

  static getFile(url) {
    return window.fetch(url)
      .then((resp) => {
        if (resp.ok) return resp.text();
        else throw Error(`${this.getUrl('html')} - ${resp.status} ${resp.statusText}`);
      });
  }

  static executeHTML(url, me) {
    return this.getFile(url)
      .then((file) => template(file).content)
      .then((content) => {
        let promise = Promise.resolve(true);
        me.template = content.querySelector('template');
        content.querySelectorAll('script').forEach((script) => {
          if (script.src) {
            window.fetch(script.src);
            promise = promise
              .then(() => window.fetch(script.src).then(resp => resp.text()))
              .then(text => new Function(text + `\n//# sourceURL=${script.src}`).call(window));
          } else {
            promise = promise.then(() => new Function(script.text + `\n//# sourceURL=${url}`).call(window));
          }
        });
        return promise;
      });
  }

  static executeJS(url) {
    return this.getFile(url)
      .then((script) => {
        return new Function(script + `\n //# sourceURL=${url}`).call();
      });
  }
}

Loader.all = {};

module.exports = Loader;
