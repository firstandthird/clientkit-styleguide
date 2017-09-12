const TaskKitTask = require('taskkit-task');
const nunjucks = require('nunjucks');
const async = require('async');
const fs = require('fs');

const objToString = (curVarName, curVarValue, curObject) => {
  if (typeof curVarValue === 'object') {
    // for each key in the object, set object recursively:
    Object.keys(curVarValue).forEach((nextVarName) => {
      const key = curVarName ? `${curVarName}-${nextVarName}` : nextVarName;
      objToString(key, curVarValue[nextVarName], curObject);
    });
    return;
  }
  curObject[curVarName] = curVarValue;
};

class ClientkitStyleguideTask extends TaskKitTask {
  init() {
    // set up the compile environment we will use:
    const path = this.options.path || process.cwd();
    this.env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path));
  }

  get defaultOptions() {
    return {
      output: 'styleguide.html',
      configKey: 'stylesheets'
    };
  }

  execute(allDone) {
    const output = this.options.output;

    const styleguide = this.kit.config[this.options.configKey];
    const template = `${__dirname}/template.njk`;

    const variables = {};
    objToString(null, styleguide.vars, variables);
    const breakpoints = {};
    objToString(null, styleguide.breakpoints, breakpoints);
    const spacing = {};
    objToString(null, styleguide.spacing, spacing);
    const grid = {};
    objToString(null, styleguide.grid, grid);

    async.autoInject({
      buffer: (done) => fs.readFile(template, done),
      compile: (buffer, done) => {
        try {
          const text = buffer.toString('utf-8');
          const renderer = nunjucks.compile(text, this.env);
          return done(null, renderer.render({
            options: this.options,
            variables,
            breakpoints,
            spacing,
            colors: styleguide.color,
            grid
          }));
        } catch (e) {
          return done(e);
        }
      },
      write: (compile, done) => this.write(output, compile, done)
    }, (err, results) => {
      if (err) {
        return allDone(err);
      }
      return allDone(null, results.compile);
    });
  }
}

module.exports = ClientkitStyleguideTask;
