const TaskKitTask = require('taskkit-task');
const nunjucks = require('nunjucks');
const async = require('async');
const fs = require('fs');
const path = require('path');
const cssToColor = require('css-color-function');
const contrast = require('contrast');

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
  get description() {
    return 'Creates a Styleguide from Clientkit\'s classes';
  }

  get classModule() {
    return path.join(__dirname, 'index.js');
  }

  get defaultOptions() {
    return {
      output: 'styleguide.html',
      uiPath: '',
      configKey: 'stylesheets'
    };
  }

  init() {
    // set up the compile environment we will use:
    const compilerPath = this.options.path || process.cwd();
    this.env = new nunjucks.Environment(new nunjucks.FileSystemLoader(compilerPath));
  }

  execute() {
    const { options, env, fullConfig: kit } = this;
    const output = this.options.output;

    const styleguide = kit[this.options.configKey];
    const template = `${__dirname}/template.njk`;

    const variables = {};
    objToString(null, styleguide.vars, variables);
    const breakpoints = {};
    objToString(null, styleguide.breakpoints, breakpoints);
    const spacing = {};
    objToString(null, styleguide.spacing, spacing);
    const grid = {};
    objToString(null, styleguide.grid, grid);

    return new Promise((resolve, reject) => {
      async.autoInject({
        buffer: (done) => fs.readFile(template, done),
        mapping(done) {
          if (!options.mapping) {
            return done(null, {});
          }
          if (!fs.existsSync(options.mapping)) {
            return done(null, {});
          }
          if (options.mapping) {
            return done(null, require(options.mapping));
          }
          done(null, {});
        },
        css(mapping, done) {
          if (!options.css) {
            return done(null, []);
          }

          const withMap = options.css.map((css) => {
            const basefile = path.basename(css);
            if (!mapping[basefile]) {
              return css;
            }
            return path.join(options.uiPath, mapping[basefile]);
          });
          done(null, withMap);
        },
        compile(buffer, css, done) {
          try {
            const text = buffer.toString('utf-8');
            const renderer = nunjucks.compile(text, env);
            const colorsMap = {};

            Object.keys(styleguide.color).forEach(colorName => {
              const color = styleguide.color[colorName];
              const bgColor = cssToColor.convert(color);

              if (!colorsMap[color]) {
                colorsMap[color] = {
                  names: [colorName],
                  backgroundColor: bgColor,
                  textColor: (contrast(bgColor) === 'light') ? '#000' : '#fff'
                };
              } else {
                colorsMap[color].names.push(colorName);
              }
            });

            return done(null, renderer.render({
              options,
              css,
              variables,
              breakpoints,
              spacing,
              colors: colorsMap,
              grid,
              configString: JSON.stringify(kit, null, '  ')
            }));
          } catch (e) {
            return done(e);
          }
        },
        write: (compile, done) => this.write(output, compile, done)
      }, (err, results) => {
        if (err) {
          return reject(err);
        }

        return resolve(results.compile);
      });
    });
  }
}

module.exports = ClientkitStyleguideTask;
