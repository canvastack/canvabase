const fs = require('fs')
const path = require('path')

module.exports = async function (context) {
  const { appOutDir } = context
  const licenseSrc = path.resolve(__dirname, '../../../LICENSE')
  const licenseDst = path.join(appOutDir, 'LICENSE')
  fs.copyFileSync(licenseSrc, licenseDst)
}
