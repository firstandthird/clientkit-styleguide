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
  init() {
    // set up the compile environment we will use:
    const path = this.options.path || process.cwd();
    this.env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path));
  }

  get defaultOptions() {
    return {
      output: 'styleguide.html',
      uiPath: '',
      configKey: 'stylesheets'
    };
  }

  execute(allDone) {
    const { options, env, kit } = this;
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
            const textColor = cssToColor.convert(color);

            if (!colorsMap[color]) {
              colorsMap[color] = {
                names: [colorName],
                backgroundColor: color,
                textColor: (contrast(textColor) === 'light') ? '#000' : '#fff'
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
            configString: JSON.stringify(kit.config, null, '  ')
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
