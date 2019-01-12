const elemTemplate = require('../templates/element');
const createFile = require('../utils/createfile');
const path = require('path');

module.exports = (argv) => {
  // Element class
  const elemName = argv.name;
  // Loader
  const elemPath = path.resolve(argv.path, `./${elemName.split('-').join('/')}.html`);
  const className = elemName.replace(/-([a-z])/g, (g) => g[1].toUpperCase()).replace(/^([a-z])/, (g) => g[0].toUpperCase());
  const extend = argv.extends ? `(${argv.extends})` : '';

  const elemHtml = elemTemplate(className, extend);

  createFile(elemPath, elemHtml, argv.force);
};