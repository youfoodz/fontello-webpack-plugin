const HtmlWebpackPlugin = require('html-webpack-plugin')
const fs = require("fs");
const _ = require("lodash")
const path = require("path")
const Chunk = require("webpack/lib/Chunk")
const config = require("./config")
const Fontello = require("./Fontello")
const Css = require("./Css")

const FONTELLO_PLUGIN = 'FontelloPlugin'

// https://github.com/jantimon/html-webpack-plugin/blob/master/index.js#L98
function getPublicPath(compilation) {
	let publicPath = compilation.mainTemplate.getPublicPath({ hash: compilation.hash }) || ""
	if(publicPath && publicPath.substr(-1) !== "/") {
		publicPath += "/"
	}
	return publicPath
}

class FontelloPlugin {
	constructor(options) {
		this.options = config(options)
		this.chunk = new Chunk(this.options.name)
		this.chunk.ids = []
    this.chunk.name = this.options.name
    this.lastConfigFile = {}
  }

  configFileUpdated() {
    if (JSON.stringify(this.lastConfigFile) !== JSON.stringify(this.options.config)) {
      this.lastConfigFile = this.options.config;
      return true;
    }
    return false;
  }

  getConfigFileContents() {
    const rawData = fs.readFileSync(this.options.configPath);
    const config = JSON.parse(rawData);
    return config;
  }

	apply(compiler) {
    const { output } = this.options
    const chunk = this.chunk
    compiler.hooks.make.tapAsync(FONTELLO_PLUGIN, (compilation, cb) => {
      this.options.config = this.getConfigFileContents()
      if (!this.configFileUpdated()) { cb() }
      else {
        const fontello = new Fontello(this.options)
        const cssFile = compilation.getPath(output.css, { chunk })
        const fontFile = ext => (
          compilation.getPath(output.font, { chunk })
            .replace(/\[ext\]/g, ext)
        )
        const cssRelativePath = ext => path.posix.relative(
          path.dirname(cssFile),
          fontFile(ext)
        )
        const addFile = (fileName, source) => {
          chunk.files.push(fileName)
          compilation.assets[fileName] = source
        }
        fontello.assets()
          .then(sources => {
            addFile(cssFile, new Css(this.options, cssRelativePath))
            for (const ext in sources) {
              addFile(fontFile(ext), sources[ext])
            }
          })
          .then(() => cb())
        if (compilation.hooks) {
          if (compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration) {
            compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration.tapAsync(FONTELLO_PLUGIN, (data, cb) => {
              console.log(getPublicPath(compilation))
              data.assets.css.push(getPublicPath(compilation) + cssFile)
              cb(null, data)
            })
          } else {
            const hooks = HtmlWebpackPlugin.getHooks(compilation)
            hooks.beforeAssetTagGeneration.tapAsync(FONTELLO_PLUGIN, (data, cb) => {
              console.log(getPublicPath(compilation))
              data.assets.css.push(getPublicPath(compilation) + cssFile)
              cb(null, data)
            })
          }
        }
        compilation.hooks.additionalAssets.tapAsync(FONTELLO_PLUGIN, cb => {
          compilation.chunks.push(chunk)
          compilation.namedChunks[this.options.name] = chunk
          cb()
        })
      }
    })
	}
}

FontelloPlugin.Css = Css

FontelloPlugin.Fontello = Fontello

module.exports = FontelloPlugin
